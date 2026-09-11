export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  let purchaseId = null;
  let paymentId = null;
  let paymentCompleted = false;

  let recipientUserId = null;
  let previousCreditBalance = 0;
  let creditsWereAdded = false;
  let createdNewUser = false;

  async function updatePurchase(fields) {
    if (!purchaseId) return false;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/family_plan_purchases?id=eq.${purchaseId}`,
      {
        method: "PATCH",
        headers: {
          "apikey": supabaseSecretKey,
          "Authorization": `Bearer ${supabaseSecretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(fields)
      }
    );

    return response.ok;
  }

  try {
    const { sourceId, recipientPhone } = req.body;

    if (!sourceId || !recipientPhone) {
      return res.status(400).json({
        success: false,
        error: "Missing payment source or recipient phone number"
      });
    }

    const digits = String(recipientPhone).replace(/\D/g, "");

    let normalizedPhone = digits;

    if (digits.length === 11 && digits.startsWith("1")) {
      normalizedPhone = digits.substring(1);
    }

    if (normalizedPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid 10-digit recipient phone number"
      });
    }

    /*
      STEP 1:
      Look up the recipient BEFORE taking any money.
    */
    const lookupResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?phone_number=eq.${encodeURIComponent(normalizedPhone)}&select=id,call_credits`,
      {
        method: "GET",
        headers: {
          "apikey": supabaseSecretKey,
          "Authorization": `Bearer ${supabaseSecretKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const existingUsers = await lookupResponse.json();

    if (!lookupResponse.ok) {
      throw new Error("Could not look up Family Plan recipient");
    }

    if (existingUsers && existingUsers.length > 0) {
      recipientUserId = existingUsers[0].id;
      previousCreditBalance =
        Number(existingUsers[0].call_credits) || 0;
    }

    /*
      STEP 2:
      Create the audit record BEFORE charging the card.
      It begins as pending.
    */
    const pendingPurchaseResponse = await fetch(
      `${supabaseUrl}/rest/v1/family_plan_purchases`,
      {
        method: "POST",
        headers: {
          "apikey": supabaseSecretKey,
          "Authorization": `Bearer ${supabaseSecretKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          recipient_phone: normalizedPhone,
          credits_purchased: 5,
          status: "pending"
        })
      }
    );

    const pendingPurchases =
      await pendingPurchaseResponse.json();

    if (
      !pendingPurchaseResponse.ok ||
      !pendingPurchases ||
      pendingPurchases.length === 0
    ) {
      throw new Error(
        "Could not create Family Plan purchase record"
      );
    }

    purchaseId = pendingPurchases[0].id;

    /*
      STEP 3:
      Charge $50 through Square.
    */
    const paymentIdempotencyKey =
      "family-" +
      Date.now().toString() +
      "-" +
      Math.random().toString(36).substring(2, 12);

    const squareResponse = await fetch(
      "https://connect.squareup.com/v2/payments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Square-Version": "2026-08-19",
          "Authorization":
            `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          source_id: sourceId,
          idempotency_key: paymentIdempotencyKey,
          amount_money: {
            amount: 5000,
            currency: "USD"
          },
          autocomplete: true,
          note:
            "ScamCheck Family Plan - 5 prepaid consultations"
        })
      }
    );

    const squareData = await squareResponse.json();

    if (!squareResponse.ok || !squareData.payment) {
      await updatePurchase({
        status: "failed"
      });

      console.error(
        "Family Plan Square error:",
        squareData
      );

      return res.status(
        squareResponse.status || 500
      ).json({
        success: false,
        error:
          "Family Plan payment could not be completed"
      });
    }

    paymentId = squareData.payment.id;

    await updatePurchase({
      square_payment_id: paymentId
    });

    /*
      The Family Plan credits are granted only after
      Square says the payment is COMPLETED.
    */
    if (squareData.payment.status !== "COMPLETED") {
      /*
        An APPROVED payment has not actually been
        completed. Cancel it rather than refund it.
      */
      if (squareData.payment.status === "APPROVED") {
        try {
          await fetch(
            `https://connect.squareup.com/v2/payments/${paymentId}/cancel`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Square-Version": "2026-08-19",
                "Authorization":
                  `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
              },
              body: JSON.stringify({})
            }
          );
        } catch (cancelError) {
          console.error(
            "Family Plan payment cancellation error:",
            cancelError
          );
        }
      }

      await updatePurchase({
        status: "failed"
      });

      return res.status(500).json({
        success: false,
        error:
          "Family Plan payment did not complete"
      });
    }

    paymentCompleted = true;

    /*
      STEP 4:
      Add 5 prepaid calls to the recipient.
    */
    const newCreditBalance =
      previousCreditBalance + 5;

    if (recipientUserId) {
      const updateUserResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${recipientUserId}`,
        {
          method: "PATCH",
          headers: {
            "apikey": supabaseSecretKey,
            "Authorization":
              `Bearer ${supabaseSecretKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            call_credits: newCreditBalance
          })
        }
      );

      if (!updateUserResponse.ok) {
        throw new Error(
          "Could not add Family Plan credits"
        );
      }

      creditsWereAdded = true;
    } else {
      const createUserResponse = await fetch(
        `${supabaseUrl}/rest/v1/users`,
        {
          method: "POST",
          headers: {
            "apikey": supabaseSecretKey,
            "Authorization":
              `Bearer ${supabaseSecretKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            phone_number: normalizedPhone,
            call_credits: 5,
            account_status: "needs_payment"
          })
        }
      );

      const newUsers =
        await createUserResponse.json();

      if (
        !createUserResponse.ok ||
        !newUsers ||
        newUsers.length === 0
      ) {
        throw new Error(
          "Could not create Family Plan recipient"
        );
      }

      recipientUserId = newUsers[0].id;
      createdNewUser = true;
      creditsWereAdded = true;
    }

    /*
      STEP 5:
      Everything succeeded.
      Mark the purchase completed.
    */
    const completedSaved =
      await updatePurchase({
        status: "completed"
      });

    if (!completedSaved) {
      throw new Error(
        "Could not mark Family Plan purchase completed"
      );
    }

    return res.status(200).json({
      success: true,
      paymentId: paymentId,
      creditsAdded: 5,
      callCredits: newCreditBalance
    });

  } catch (error) {
    console.error(
      "Family Plan purchase error:",
      error
    );

    /*
      If the $50 payment never completed,
      there is nothing to refund.
    */
    if (!paymentCompleted) {
      await updatePurchase({
        status: "failed"
      });

      return res.status(500).json({
        success: false,
        error:
          "The Family Plan purchase could not be completed."
      });
    }

    /*
      If Square DID complete the $50 payment,
      undo any credits we added before refunding.
    */
    let creditRollbackSucceeded = true;

    try {
      if (creditsWereAdded && recipientUserId) {
        if (createdNewUser) {
          const deleteResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${recipientUserId}`,
            {
              method: "DELETE",
              headers: {
                "apikey": supabaseSecretKey,
                "Authorization":
                  `Bearer ${supabaseSecretKey}`,
                "Content-Type": "application/json"
              }
            }
          );

          if (!deleteResponse.ok) {
            creditRollbackSucceeded = false;
          }
        } else {
          const rollbackResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${recipientUserId}`,
            {
              method: "PATCH",
              headers: {
                "apikey": supabaseSecretKey,
                "Authorization":
                  `Bearer ${supabaseSecretKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                call_credits:
                  previousCreditBalance
              })
            }
          );

          if (!rollbackResponse.ok) {
            creditRollbackSucceeded = false;
          }
        }
      }
    } catch (rollbackError) {
      creditRollbackSucceeded = false;

      console.error(
        "Family Plan credit rollback error:",
        rollbackError
      );
    }

    /*
      Request a full $50 Square refund.
    */
    try {
      const refundIdempotencyKey =
        "frefund-" +
        Date.now().toString() +
        "-" +
        Math.random().toString(36).substring(2, 10);

      const refundResponse = await fetch(
        "https://connect.squareup.com/v2/refunds",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Square-Version": "2026-08-19",
            "Authorization":
              `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            idempotency_key:
              refundIdempotencyKey,
            payment_id: paymentId,
            amount_money: {
              amount: 5000,
              currency: "USD"
            },
            reason:
              "ScamCheck Family Plan setup failed"
          })
        }
      );

      const refundData =
        await refundResponse.json();

      if (
        refundResponse.ok &&
        refundData.refund
      ) {
        const refundStatus =
          refundData.refund.status;

        if (!creditRollbackSucceeded) {
          await updatePurchase({
            status: "recovery_needed"
          });
        } else if (
          refundStatus === "COMPLETED"
        ) {
          await updatePurchase({
            status: "refunded"
          });
        } else {
          await updatePurchase({
            status: "refund_pending"
          });
        }
      } else {
        console.error(
          "Family Plan refund failed:",
          refundData
        );

        await updatePurchase({
          status: creditRollbackSucceeded
            ? "refund_failed"
            : "recovery_needed"
        });
      }
    } catch (refundError) {
      console.error(
        "Family Plan refund error:",
        refundError
      );

      await updatePurchase({
        status: creditRollbackSucceeded
          ? "refund_failed"
          : "recovery_needed"
      });
    }

    return res.status(500).json({
      success: false,
      error:
        "The Family Plan purchase could not be completed. If a charge appears on your card, ScamCheck has attempted an automatic refund. Please contact ask@askscamcheck.com if you need assistance."
    });
  }
}
