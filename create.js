/* ============================================================
   MOMENT — create.js
   Complete production order collection system
   Google Apps Script → Google Sheets + Google Drive
   ============================================================ */


/* ============================================================
   BACKEND CONFIG
   ============================================================ */

const BACKEND_CONFIG = {
  endpoint:
    "https://script.google.com/macros/s/AKfycbxZP-Z7T4G5oQ8pApGSlg3G-rSoOQ7dqKIibsZ9fZi3jWgxo9M3Edz7vZtLWon6Z8JJ/exec"
};


/* ============================================================
   PAYMENT CONFIG
   Manual payment only.
   Customer is contacted on WhatsApp after order submission.
   ============================================================ */

const PAYMENT_URL = "";


/* ============================================================
   MASTER ORDER OBJECT
   ============================================================ */

const ORDER = {

  occasion: "",

  recipient: {
    name: "",
    relationship: "",
    personality: "",
    additionalInfo: ""
  },

  story: {
    favoriteMemory: "",
    whySpecial: "",
    insideJokes: "",
    message: "",
    additionalNotes: ""
  },

  feeling: {
    moods: [],
    desiredReaction: [],
    intensity: "3"
  },

  media: {
    photos: []
  },

  design: {
    style: "",
    colors: [],
    specialRequests: "",
    additionalDesignNotes: ""
  },

  package: {
    id: "memories",
    name: "MEMORIES",
    total: 149,
    advance: 50,
    remaining: 99
  },

  delivery: {
    customerName: "",
    whatsapp: "",
    email: "",
    deadline: "",
    method: "WhatsApp"
  },

  /*
   * Created once per order.
   * Used by backend to prevent duplicate submissions.
   */
  submissionKey: ""
};


/* ============================================================
   INTENSITY LABELS
   ============================================================ */

const INTENSITY_MAP = {

  "1": "Subtle & Gentle",

  "2": "Soft & Meaningful",

  "3": "Balanced & Heartfelt",

  "4": "Strong Emotional Impact",

  "5": "FULL EMOTIONAL DAMAGE"

};


/* ============================================================
   PACKAGE DEFINITIONS
   ============================================================ */

const PACKAGES = {

  essential: {

    id: "essential",

    name: "ESSENTIAL",

    formLabel: "Essential — ₹99",

    total: 99,

    advance: 50,

    allowsPhotos: false

  },

  memories: {

    id: "memories",

    name: "MEMORIES",

    formLabel: "Memories — ₹149",

    total: 149,

    advance: 50,

    allowsPhotos: true

  },

  cinematic: {

    id: "cinematic",

    name: "CINEMATIC",

    formLabel: "Cinematic — ₹199",

    total: 199,

    advance: 50,

    allowsPhotos: true

  }

};


/* ============================================================
   STATE
   ============================================================ */

let currentStep = 1;

const TOTAL_STEPS = 10;

const DRAFT_KEY = "moment_draft_order";

let isSubmitting = false;


/* ============================================================
   DOM INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  initDraftCheck();

  initStepListeners();

  initFormInputs();


  initPackageSelection();

  updateStepUI();

});


/* ============================================================
   SUBMISSION KEY
   ============================================================ */

function createSubmissionKey() {

  return (

    "SUB-" +

    Date.now() +

    "-" +

    Math.random()

      .toString(36)

      .substring(2, 10)

  );

}


/* ============================================================
   SUBMIT ORDER TO GOOGLE APPS SCRIPT
   ============================================================ */

async function submitOrderToBackend(order) {

  if (
    !BACKEND_CONFIG.endpoint ||
    BACKEND_CONFIG.endpoint === "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE"
  ) {
    throw new Error("Backend endpoint is not configured.");
  }

  if (!order.submissionKey) {
    order.submissionKey = createSubmissionKey();
  }

  const packageId = order.package?.id || "memories";

  const mediaByPackage = {
    essential: {
      mediaIncluded: false,
      mediaType: "none"
    },
    memories: {
      mediaIncluded: true,
      mediaType: "photos_via_whatsapp"
    },
    cinematic: {
      mediaIncluded: true,
      mediaType: "photos_and_videos_via_whatsapp"
    }
  };

  const media = mediaByPackage[packageId] || mediaByPackage.memories;

  const payload = {
    submissionKey: order.submissionKey,

    occasion: order.occasion || "",

    recipient: {
      name: order.recipient?.name || "",
      relationship: order.recipient?.relationship || "",
      personality: order.recipient?.personality || "",
      additionalInfo: order.recipient?.additionalInfo || ""
    },

    story: {
      favoriteMemory: order.story?.favoriteMemory || "",
      whySpecial: order.story?.whySpecial || "",
      insideJokes: order.story?.insideJokes || "",
      message: order.story?.message || "",
      additionalNotes: order.story?.additionalNotes || ""
    },

    feeling: {
      moods: Array.isArray(order.feeling?.moods)
        ? order.feeling.moods.slice()
        : [],
      desiredReaction: Array.isArray(order.feeling?.desiredReaction)
        ? order.feeling.desiredReaction.slice()
        : [],
      intensity: order.feeling?.intensity || "3"
    },

    media,

    design: {
      style: order.design?.style || "",
      colors: Array.isArray(order.design?.colors)
        ? order.design.colors.slice()
        : [],
      specialRequests: order.design?.specialRequests || "",
      additionalDesignNotes: order.design?.additionalDesignNotes || ""
    },

    package: {
      id: packageId,
      name: order.package?.name || "MEMORIES",
      total: order.package?.total || 149,
      advance: order.package?.advance || 50,
      remaining: order.package?.remaining || 99
    },

    delivery: {
      customerName: order.delivery?.customerName || "",
      whatsapp: order.delivery?.whatsapp || "",
      email: order.delivery?.email || "",
      deadline: order.delivery?.deadline || "",
      method: order.delivery?.method || "WhatsApp"
    }
  };

  console.group("[MOMENT] Submitting lightweight order");
  console.log("Backend:", BACKEND_CONFIG.endpoint);
  console.log("Submission Key:", payload.submissionKey);
  console.log("Media entitlement:", payload.media);
  console.groupEnd();

  const response = await fetch(
    BACKEND_CONFIG.endpoint,
    {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}.`);
  }

  const text = await response.text();

  let result;

  try {
    result = JSON.parse(text);
  } catch (err) {
    console.error("[MOMENT] Non-JSON backend response:", text);
    throw new Error("Unexpected response from server.");
  }

  if (!result || result.success !== true) {
    throw new Error(
      result?.message || "Order was not accepted."
    );
  }

  if (!result.orderId) {
    throw new Error("Server did not return an Order ID.");
  }

  console.log("[MOMENT] Order accepted:", result.orderId);

  return result;
}

/* ============================================================
   FILE → BASE64 DATA URL
   ============================================================ */


/* ============================================================
   ORDER SUBMISSION HANDLER
   ============================================================ */

function handleOrderSubmit() {

  if (isSubmitting) return;


  collectOrderData();


  if (!validateFinalOrder()) {

    return;

  }


  isSubmitting = true;


  const submitBtn =
    document.getElementById(
      "btn-submit-order"
    );


  const retryBtn =
    document.getElementById(
      "btn-retry-submit"
    );


  if (submitBtn) {

    submitBtn.disabled = true;

    submitBtn.textContent =
      "Submitting…";

  }


  if (retryBtn) {

    retryBtn.disabled = true;

    retryBtn.textContent =
      "Retrying…";

  }


  submitOrderToBackend(ORDER)

    .then((result) => {

      isSubmitting = false;


      /*
       * Delete draft only AFTER backend
       * confirms successful order.
       */

      localStorage.removeItem(
        DRAFT_KEY
      );


      showConfirmation(
        result.orderId
      );

    })


    .catch((err) => {

      isSubmitting = false;


      console.error(
        "[MOMENT] Submission failed:",
        err
      );


      /*
       * Keep customer data.
       */

      restoreSubmitButton();


      showSubmissionError(
        err
      );

    });

}


/* ============================================================
   FINAL VALIDATION
   ============================================================ */

function validateFinalOrder() {

  collectOrderData();


  if (
    !ORDER.occasion ||
    !ORDER.occasion.trim()
  ) {

    showError(
      "error-step-1"
    );

    goToStep(1);

    return false;

  }


  if (
    !ORDER.recipient.name ||
    !ORDER.recipient.name.trim()
  ) {

    showError(
      "error-recipient-name"
    );

    goToStep(2);

    return false;

  }


  if (
    !ORDER.delivery.customerName ||
    !ORDER.delivery.customerName.trim()
  ) {

    showError(
      "error-customer-name"
    );

    goToStep(8);

    return false;

  }


  if (
    !ORDER.delivery.whatsapp ||
    !ORDER.delivery.whatsapp.trim()
  ) {

    showError(
      "error-customer-whatsapp"
    );

    goToStep(8);

    return false;

  }


  if (
    !ORDER.package ||
    !ORDER.package.id
  ) {

    showError(
      "error-step-7"
    );

    goToStep(7);

    return false;

  }


  return true;

}


/* ============================================================
   RESTORE SUBMIT BUTTON
   ============================================================ */

function restoreSubmitButton() {

  const submitBtn =
    document.getElementById(
      "btn-submit-order"
    );


  const retryBtn =
    document.getElementById(
      "btn-retry-submit"
    );


  if (submitBtn) {

    submitBtn.disabled = false;

    submitBtn.textContent =
      "Submit My Request →";

  }


  if (retryBtn) {

    retryBtn.disabled = false;

    retryBtn.textContent =
      "Try Again";

  }

}


/* ============================================================
   SUBMISSION ERROR
   ============================================================ */

function showSubmissionError(err) {

  const submitReady =
    document.getElementById(
      "submit-state-ready"
    );


  const submitError =
    document.getElementById(
      "submit-error-state"
    );


  const errorMsgText =
    document.getElementById(
      "error-message-text"
    );


  restoreSubmitButton();


  if (errorMsgText) {

    errorMsgText.textContent =

      err && err.message

        ? `Submission failed: ${err.message}. Your responses are safe. Please try again.`

        : "We couldn't send your request. Please check your connection and try again. Your responses are safe.";

  }


  if (submitReady) {

    submitReady.classList.add(
      "is-hidden"
    );

  }


  if (submitError) {

    submitError.classList.remove(
      "is-hidden"
    );

  }

}


/* ============================================================
   SUCCESS CONFIRMATION
   ============================================================ */

function showConfirmation(orderId) {

  const submitReady =
    document.getElementById(
      "submit-state-ready"
    );


  const submitError =
    document.getElementById(
      "submit-error-state"
    );


  const paymentState =
    document.getElementById(
      "payment-state"
    );


  const confirmState =
    document.getElementById(
      "confirmation-state"
    );


  if (submitReady) {

    submitReady.classList.add(
      "is-hidden"
    );

  }


  if (submitError) {

    submitError.classList.add(
      "is-hidden"
    );

  }


  if (paymentState) {

    paymentState.classList.add(
      "is-hidden"
    );

  }


  if (confirmState) {

    confirmState.innerHTML = `

      <div class="confirmation-card">

        <div class="confirmation-icon">
          ❤️
        </div>

        <h2 class="confirmation-title">
          Your request is in. ❤️
        </h2>

        <p class="confirmation-lead">
          Order ID:
          <strong>
            ${escapeHtml(
              orderId || "—"
            )}
          </strong>
        </p>

        <p class="confirmation-body">

          We'll contact you on WhatsApp shortly
          with payment details.

          <br><br>

          Advance: ₹50
          &nbsp;·&nbsp;
          Payment Status: Pending

        </p>

        <div class="confirmation-cta">

          <a
            href="index.html"
            class="btn btn--ghost"
          >
            Return to Home
          </a>

        </div>

      </div>

    `;


    confirmState.classList.remove(
      "is-hidden"
    );

  }


  localStorage.removeItem(
    DRAFT_KEY
  );


  const bar =
    document.getElementById(
      "create-bar"
    );


  if (bar) {

    bar.style.display = "none";

  }

}


/* ============================================================
   ESCAPE HTML
   ============================================================ */

function escapeHtml(str) {

  return String(str)

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


/* ============================================================
   PAYMENT HANDLER
   Manual payment — no gateway.
   ============================================================ */

function handleAdvancePayment() {

  const paymentState =
    document.getElementById(
      "payment-state"
    );


  const confirmState =
    document.getElementById(
      "confirmation-state"
    );


  if (
    PAYMENT_URL &&
    PAYMENT_URL.trim() !== ""
  ) {

    window.open(
      PAYMENT_URL,
      "_blank"
    );

  }


  if (paymentState) {

    paymentState.classList.add(
      "is-hidden"
    );

  }


  if (confirmState) {

    confirmState.classList.remove(
      "is-hidden"
    );

  }

}


/* ============================================================
   DRAFT PERSISTENCE
   ============================================================ */

function initDraftCheck() {

  const saved =
    localStorage.getItem(
      DRAFT_KEY
    );


  if (!saved) return;


  try {

    const draft =
      JSON.parse(saved);


    if (
      draft &&
      draft.occasion
    ) {

      const banner =
        document.getElementById(
          "draft-banner"
        );


      if (banner) {

        banner.classList.remove(
          "is-hidden"
        );

      }


      document
        .getElementById(
          "btn-restore-draft"
        )
        ?.addEventListener(
          "click",
          () => {

            restoreDraft(
              draft
            );

            banner?.classList.add(
              "is-hidden"
            );

          }
        );


      document
        .getElementById(
          "btn-discard-draft"
        )
        ?.addEventListener(
          "click",
          () => {

            clearDraft();

            banner?.classList.add(
              "is-hidden"
            );

          }
        );

    }

  } catch (e) {

    console.warn(
      "[MOMENT] Could not parse draft:",
      e
    );

  }

}


/* ============================================================
   SAVE DRAFT
   ============================================================ */

function saveDraft() {

  collectOrderData();


  try {

    /*
     * IMPORTANT:
     * File objects are NOT saved here.
     * Only metadata is stored.
     */

    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify(ORDER)
    );

  } catch (e) {

    console.warn(
      "[MOMENT] Could not save draft:",
      e
    );

  }

}


/* ============================================================
   CLEAR DRAFT
   ============================================================ */

function clearDraft() {

  localStorage.removeItem(
    DRAFT_KEY
  );


  resetFormState();

}


/* ============================================================
   RESTORE DRAFT
   ============================================================ */

function restoreDraft(draft) {

  Object.assign(
    ORDER,
    draft
  );


  if (!ORDER.recipient) {

    ORDER.recipient = {

      name: "",

      relationship: "",

      personality: "",

      additionalInfo: ""

    };

  }


  if (!ORDER.story) {

    ORDER.story = {

      favoriteMemory: "",

      whySpecial: "",

      insideJokes: "",

      message: "",

      additionalNotes: ""

    };

  }


  if (!ORDER.feeling) {

    ORDER.feeling = {

      moods: [],

      desiredReaction: [],

      intensity: "3"

    };

  }


  if (!Array.isArray(
    ORDER.feeling.moods
  )) {

    ORDER.feeling.moods = [];

  }


  if (!Array.isArray(
    ORDER.feeling.desiredReaction
  )) {

    ORDER.feeling.desiredReaction = [];

  }


  if (!ORDER.media) {
    ORDER.media = { mediaIncluded: true, mediaType: "photos_via_whatsapp" };
  }


  if (!ORDER.design) {

    ORDER.design = {

      style: "",

      colors: [],

      specialRequests: "",

      additionalDesignNotes: ""

    };

  }


  if (!Array.isArray(
    ORDER.design.colors
  )) {

    ORDER.design.colors = [];

  }


  if (!ORDER.delivery) {

    ORDER.delivery = {

      customerName: "",

      whatsapp: "",

      email: "",

      deadline: "",

      method: "WhatsApp"

    };

  }


  if (!ORDER.package) {

    ORDER.package =
      PACKAGES.memories;

  }


  populateUIFromOrder();

  updateStepUI();

}


/* ============================================================
   RESET FORM
   ============================================================ */

function resetFormState() {


  ORDER.occasion = "";


  ORDER.recipient = {

    name: "",

    relationship: "",

    personality: "",

    additionalInfo: ""

  };


  ORDER.story = {

    favoriteMemory: "",

    whySpecial: "",

    insideJokes: "",

    message: "",

    additionalNotes: ""

  };


  ORDER.feeling = {

    moods: [],

    desiredReaction: [],

    intensity: "3"

  };


  ORDER.media = { mediaIncluded: true, mediaType: "photos_via_whatsapp" };


  ORDER.design = {

    style: "",

    colors: [],

    specialRequests: "",

    additionalDesignNotes: ""

  };


  ORDER.package = {

    id: "memories",

    name: "MEMORIES",

    total: 149,

    advance: 50,

    remaining: 99

  };


  ORDER.delivery = {

    customerName: "",

    whatsapp: "",

    email: "",

    deadline: "",

    method: "WhatsApp"

  };


  ORDER.submissionKey = "";


  document
    .getElementById(
      "experience-form"
    )
    ?.reset();



  populateUIFromOrder();

  updateStepUI();

}


/* ============================================================
   POPULATE UI FROM ORDER
   ============================================================ */

function populateUIFromOrder() {

  /* ------------------------------
     STEP 1
     ------------------------------ */

  document
    .querySelectorAll(
      "[data-occasion]"
    )
    .forEach((btn) => {

      btn.classList.toggle(

        "option-card--selected",

        btn.dataset.occasion ===
          ORDER.occasion

      );

    });


  /* ------------------------------
     STEP 2
     ------------------------------ */

  const nameEl =
    document.getElementById(
      "recipient-name"
    );


  if (nameEl) {

    nameEl.value =
      ORDER.recipient.name || "";

  }


  const persEl =
    document.getElementById(
      "recipient-personality"
    );


  if (persEl) {

    persEl.value =
      ORDER.recipient.personality || "";

  }


  const addEl =
    document.getElementById(
      "recipient-additional"
    );


  if (addEl) {

    addEl.value =
      ORDER.recipient.additionalInfo || "";

  }


  document
    .querySelectorAll(
      "[data-rel]"
    )
    .forEach((btn) => {

      btn.classList.toggle(

        "chip-btn--selected",

        btn.dataset.rel ===
          ORDER.recipient.relationship

      );

    });


  /* ------------------------------
     STEP 3
     ------------------------------ */

  const memEl =
    document.getElementById(
      "story-memory"
    );


  if (memEl) {

    memEl.value =
      ORDER.story.favoriteMemory || "";

  }


  const specEl =
    document.getElementById(
      "story-special"
    );


  if (specEl) {

    specEl.value =
      ORDER.story.whySpecial || "";

  }


  const jokeEl =
    document.getElementById(
      "story-jokes"
    );


  if (jokeEl) {

    jokeEl.value =
      ORDER.story.insideJokes || "";

  }


  const msgEl =
    document.getElementById(
      "story-message"
    );


  if (msgEl) {

    msgEl.value =
      ORDER.story.message || "";

  }


  const noteEl =
    document.getElementById(
      "story-notes"
    );


  if (noteEl) {

    noteEl.value =
      ORDER.story.additionalNotes || "";

  }


  /* ------------------------------
     STEP 4
     ------------------------------ */

  document
    .querySelectorAll(
      "[data-mood]"
    )
    .forEach((btn) => {

      btn.classList.toggle(

        "chip-btn--selected",

        ORDER.feeling.moods.includes(
          btn.dataset.mood
        )

      );

    });


  document
    .querySelectorAll(
      "[data-reaction]"
    )
    .forEach((btn) => {

      btn.classList.toggle(

        "chip-btn--selected",

        ORDER.feeling.desiredReaction.includes(
          btn.dataset.reaction
        )

      );

    });


  const slider =
    document.getElementById(
      "intensity-slider"
    );


  if (slider) {

    slider.value =
      ORDER.feeling.intensity || "3";

    updateSliderLabel(
      slider.value
    );

  }


  /* ------------------------------
     STEP 6
     ------------------------------ */

  document
    .querySelectorAll(
      "[data-style]"
    )
    .forEach((btn) => {

      btn.classList.toggle(

        "chip-btn--selected",

        btn.dataset.style ===
          ORDER.design.style

      );

    });


  document
    .querySelectorAll(
      "[data-color]"
    )
    .forEach((btn) => {

      btn.classList.toggle(

        "chip-btn--selected",

        ORDER.design.colors.includes(
          btn.dataset.color
        )

      );

    });


  const reqEl =
    document.getElementById(
      "special-requests"
    );


  if (reqEl) {

    reqEl.value =
      ORDER.design.specialRequests || "";

  }


  /* ------------------------------
     STEP 7
     ------------------------------ */

  selectPackage(
    ORDER.package.id ||
      "memories"
  );


  /* ------------------------------
     STEP 8
     ------------------------------ */

  const cNameEl =
    document.getElementById(
      "customer-name"
    );


  if (cNameEl) {

    cNameEl.value =
      ORDER.delivery.customerName || "";

  }


  const cWaEl =
    document.getElementById(
      "customer-whatsapp"
    );


  if (cWaEl) {

    cWaEl.value =
      ORDER.delivery.whatsapp || "";

  }


  const cEmEl =
    document.getElementById(
      "customer-email"
    );


  if (cEmEl) {

    cEmEl.value =
      ORDER.delivery.email || "";

  }


  const cDlEl =
    document.getElementById(
      "customer-deadline"
    );


  if (cDlEl) {

    cDlEl.value =
      ORDER.delivery.deadline || "";

  }


  document
    .querySelectorAll(
      "[data-delivery]"
    )
    .forEach((btn) => {

      btn.classList.toggle(

        "chip-btn--selected",

        btn.dataset.delivery ===
          ORDER.delivery.method

      );

    });


  /*
   * Important:
   * Actual File objects cannot be restored
   * after page reload.
   */


}


/* ============================================================
   STEP NAVIGATION
   ============================================================ */

function initStepListeners() {

  document
    .getElementById(
      "btn-next"
    )
    ?.addEventListener(
      "click",
      (e) => {

        e.preventDefault();


        if (
          currentStep <
          TOTAL_STEPS
        ) {

          if (
            validateCurrentStep()
          ) {

            saveDraft();

            goToStep(
              currentStep + 1
            );

          }

        }

      }
    );


  document
    .getElementById(
      "btn-prev"
    )
    ?.addEventListener(
      "click",
      (e) => {

        e.preventDefault();


        if (
          currentStep > 1
        ) {

          goToStep(
            currentStep - 1
          );

        }

      }
    );


  document
    .getElementById(
      "btn-submit-order"
    )
    ?.addEventListener(
      "click",
      (e) => {

        e.preventDefault();

        handleOrderSubmit();

      }
    );


  document
    .getElementById(
      "btn-retry-submit"
    )
    ?.addEventListener(
      "click",
      (e) => {

        e.preventDefault();


        const submitReady =
          document.getElementById(
            "submit-state-ready"
          );


        const submitError =
          document.getElementById(
            "submit-error-state"
          );


        if (submitError) {

          submitError.classList.add(
            "is-hidden"
          );

        }


        if (submitReady) {

          submitReady.classList.remove(
            "is-hidden"
          );

        }


        handleOrderSubmit();

      }
    );


  document
    .getElementById(
      "btn-pay-advance"
    )
    ?.addEventListener(
      "click",
      (e) => {

        e.preventDefault();

        handleAdvancePayment();

      }
    );


  document
    .getElementById(
      "btn-clear-responses"
    )
    ?.addEventListener(
      "click",
      (e) => {

        e.preventDefault();


        if (
          confirm(
            "Are you sure you want to clear all responses and start fresh?"
          )
        ) {

          clearDraft();

          goToStep(1);

        }

      }
    );

}


/* ============================================================
   GO TO STEP
   ============================================================ */

function goToStep(stepNum) {

  if (
    stepNum < 1 ||
    stepNum > TOTAL_STEPS
  ) {

    return;

  }


  document
    .querySelectorAll(
      ".form-step"
    )
    .forEach((el) => {

      el.classList.remove(
        "form-step--active"
      );

    });


  currentStep =
    stepNum;


  const target =

    document.querySelector(
      `.form-step[data-step="${currentStep}"]`
    ) ||

    document.getElementById(
      `step-${currentStep}`
    );


  if (target) {

    target.classList.add(
      "form-step--active"
    );

  }


  if (
    currentStep === 9
  ) {

    renderReviewSummary();

  }


  updateStepUI();


  window.scrollTo({

    top: 0,

    behavior: "smooth"

  });

}


/* ============================================================
   STEP UI
   ============================================================ */

function updateStepUI() {

  const fmt =
    String(currentStep)
      .padStart(2, "0");


  const badge =
    document.getElementById(
      "step-badge"
    );


  if (badge) {

    badge.textContent =
      `Step ${fmt} of ${TOTAL_STEPS}`;

  }


  const fill =
    document.getElementById(
      "progress-fill"
    );


  if (fill) {

    fill.style.width =
      `${(currentStep / TOTAL_STEPS) * 100}%`;

  }


  const prevBtn =
    document.getElementById(
      "btn-prev"
    );


  const nextBtn =
    document.getElementById(
      "btn-next"
    );


  const stepText =
    document.getElementById(
      "bar-step-text"
    );


  if (prevBtn) {

    prevBtn.style.visibility =

      currentStep > 1 &&
      currentStep <= 9

        ? "visible"

        : "hidden";

  }


  if (nextBtn) {

    if (
      currentStep === 9
    ) {

      nextBtn.textContent =
        "Review & Submit →";

      nextBtn.style.display =
        "inline-flex";

    }

    else if (
      currentStep === 10
    ) {

      nextBtn.style.display =
        "none";

    }

    else {

      nextBtn.textContent =
        "Next →";

      nextBtn.style.display =
        "inline-flex";

    }

  }


  if (stepText) {

    stepText.textContent =
      `Step ${fmt} of ${TOTAL_STEPS}`;

  }


  const dotsContainer =
    document.getElementById(
      "bar-dots"
    );


  if (dotsContainer) {

    dotsContainer.innerHTML =

      Array
        .from({
          length:
            TOTAL_STEPS
        })

        .map((_, i) => {

          const step =
            i + 1;

          let cls =
            "dot-step";


          if (
            step ===
            currentStep
          ) {

            cls +=
              " dot-step--active";

          }

          else if (
            step <
            currentStep
          ) {

            cls +=
              " dot-step--completed";

          }


          return `
            <span
              class="${cls}"
            ></span>
          `;

        })

        .join("");

  }

}


/* ============================================================
   FORM INPUTS
   ============================================================ */

function initFormInputs() {


  /* ==========================================================
     STEP 1 — OCCASION
     ========================================================== */

  document
    .querySelectorAll(
      "[data-occasion]"
    )
    .forEach((btn) => {

      btn.addEventListener(
        "click",
        (e) => {

          e.preventDefault();


          document
            .querySelectorAll(
              "[data-occasion]"
            )
            .forEach((b) => {

              b.classList.remove(
                "option-card--selected"
              );

            });


          btn.classList.add(
            "option-card--selected"
          );


          ORDER.occasion =
            btn.dataset.occasion;


          hideError(
            "error-step-1"
          );


          saveDraft();


          setTimeout(() => {

            if (
              currentStep === 1 &&
              ORDER.occasion
            ) {

              goToStep(2);

            }

          }, 200);

        }
      );

    });


  /* ==========================================================
     STEP 2 — RELATIONSHIP
     ========================================================== */

  document
    .querySelectorAll(
      "[data-rel]"
    )
    .forEach((btn) => {

      btn.addEventListener(
        "click",
        (e) => {

          e.preventDefault();


          document
            .querySelectorAll(
              "[data-rel]"
            )
            .forEach((b) => {

              b.classList.remove(
                "chip-btn--selected"
              );

            });


          btn.classList.add(
            "chip-btn--selected"
          );


          ORDER.recipient.relationship =
            btn.dataset.rel;


          saveDraft();

        }
      );

    });


  /* ==========================================================
     STEP 4 — MOODS
     ========================================================== */

  document
    .querySelectorAll(
      "[data-mood]"
    )
    .forEach((btn) => {

      btn.addEventListener(
        "click",
        (e) => {

          e.preventDefault();


          const mood =
            btn.dataset.mood;


          btn.classList.toggle(
            "chip-btn--selected"
          );


          if (
            ORDER.feeling.moods.includes(
              mood
            )
          ) {

            ORDER.feeling.moods =
              ORDER.feeling.moods.filter(
                (m) =>
                  m !== mood
              );

          }

          else {

            ORDER.feeling.moods.push(
              mood
            );

          }


          saveDraft();

        }
      );

    });


  /* ==========================================================
     STEP 4 — DESIRED REACTION
     ========================================================== */

  document
    .querySelectorAll(
      "[data-reaction]"
    )
    .forEach((btn) => {

      btn.addEventListener(
        "click",
        (e) => {

          e.preventDefault();


          const react =
            btn.dataset.reaction;


          btn.classList.toggle(
            "chip-btn--selected"
          );


          if (
            ORDER.feeling.desiredReaction.includes(
              react
            )
          ) {

            ORDER.feeling.desiredReaction =
              ORDER.feeling.desiredReaction.filter(
                (r) =>
                  r !== react
              );

          }

          else {

            ORDER.feeling.desiredReaction.push(
              react
            );

          }


          saveDraft();

        }
      );

    });


  /* ==========================================================
     STEP 4 — INTENSITY
     ========================================================== */

  const slider =
    document.getElementById(
      "intensity-slider"
    );


  if (slider) {

    slider.addEventListener(
      "input",
      (e) => {

        ORDER.feeling.intensity =
          e.target.value;


        updateSliderLabel(
          e.target.value
        );


        saveDraft();

      }
    );

  }


  /* ==========================================================
     STEP 6 — STYLE
     ========================================================== */

  document
    .querySelectorAll(
      "[data-style]"
    )
    .forEach((btn) => {

      btn.addEventListener(
        "click",
        (e) => {

          e.preventDefault();


          document
            .querySelectorAll(
              "[data-style]"
            )
            .forEach((b) => {

              b.classList.remove(
                "chip-btn--selected"
              );

            });


          btn.classList.add(
            "chip-btn--selected"
          );


          ORDER.design.style =
            btn.dataset.style;


          saveDraft();

        }
      );

    });


  /* ==========================================================
     STEP 6 — COLORS
     ========================================================== */

  document
    .querySelectorAll(
      "[data-color]"
    )
    .forEach((btn) => {

      btn.addEventListener(
        "click",
        (e) => {

          e.preventDefault();


          const col =
            btn.dataset.color;


          btn.classList.toggle(
            "chip-btn--selected"
          );


          if (
            ORDER.design.colors.includes(
              col
            )
          ) {

            ORDER.design.colors =
              ORDER.design.colors.filter(
                (c) =>
                  c !== col
              );

          }

          else {

            ORDER.design.colors.push(
              col
            );

          }


          saveDraft();

        }
      );

    });


  /* ==========================================================
     STEP 8 — DELIVERY METHOD
     ========================================================== */

  document
    .querySelectorAll(
      "[data-delivery]"
    )
    .forEach((btn) => {

      btn.addEventListener(
        "click",
        (e) => {

          e.preventDefault();


          document
            .querySelectorAll(
              "[data-delivery]"
            )
            .forEach((b) => {

              b.classList.remove(
                "chip-btn--selected"
              );

            });


          btn.classList.add(
            "chip-btn--selected"
          );


          ORDER.delivery.method =
            btn.dataset.delivery;


          saveDraft();

        }
      );

    });


  /* ==========================================================
     TEXT INPUTS
     ========================================================== */

  const textInputIds = [

    "recipient-name",

    "recipient-personality",

    "recipient-additional",

    "story-memory",

    "story-special",

    "story-jokes",

    "story-message",

    "story-notes",

    "special-requests",

    "customer-name",

    "customer-whatsapp",

    "customer-email",

    "customer-deadline"

  ];


  textInputIds.forEach(
    (id) => {

      const el =
        document.getElementById(
          id
        );


      if (el) {

        el.addEventListener(
          "input",
          () => {

            hideError(
              `error-${id}`
            );


            saveDraft();

          }
        );

      }

    }
  );

}


/* ============================================================
   SLIDER LABEL
   ============================================================ */

function updateSliderLabel(val) {

  const lbl =
    document.getElementById(
      "intensity-val-label"
    );


  if (lbl) {

    lbl.textContent =
      INTENSITY_MAP[val] ||
      "Balanced";

  }

}


/* ============================================================
   PACKAGE SELECTION
   ============================================================ */

function initPackageSelection() {

  document
    .querySelectorAll(
      "[data-package]"
    )
    .forEach((card) => {

      card.addEventListener(
        "click",
        (e) => {

          e.preventDefault();


          selectPackage(
            card.dataset.package
          );


          saveDraft();

        }
      );

    });

}


/* ============================================================
   SELECT PACKAGE
   ============================================================ */

function selectPackage(pkgId) {

  const pkg =
    PACKAGES[pkgId] ||
    PACKAGES.memories;


  ORDER.package.id =
    pkg.id;


  ORDER.package.name =
    pkg.name;


  ORDER.package.total =
    pkg.total;


  ORDER.package.advance =
    pkg.advance;


  ORDER.package.remaining =
    pkg.total -
    pkg.advance;


  document
    .querySelectorAll(
      "[data-package]"
    )
    .forEach((c) => {

      c.classList.toggle(

        "package-card--selected",

        c.dataset.package ===
          pkgId

      );

    });


  const totalEl =
    document.getElementById(
      "calc-total"
    );


  const advEl =
    document.getElementById(
      "calc-advance"
    );


  const remEl =
    document.getElementById(
      "calc-remaining"
    );


  if (totalEl) {

    totalEl.textContent =
      `₹${ORDER.package.total}`;

  }


  if (advEl) {

    advEl.textContent =
      `₹${ORDER.package.advance}`;

  }


  if (remEl) {

    remEl.textContent =
      `₹${ORDER.package.remaining}`;

  }


  hideError(
    "error-step-7"
  );


  checkMediaPackageRules();

}


/* ============================================================
   MEDIA UPLOADER
   ============================================================ */

function updateMediaInfo() {

  const noticeText = document.getElementById("media-notice-text");
  const statusText = document.getElementById("media-status-text");
  const selectedPackage = document.getElementById("media-selected-package");
  const packageCards = document.querySelectorAll("[data-media-package]");

  const pkgId = ORDER.package?.id || "memories";

  const content = {
    essential: {
      package: "ESSENTIAL — ₹99",
      status: "Media isn't included with Essential. Want to add photos? Choose Memories. Want photos + videos? Choose Cinematic.",
      included: false,
      type: "none"
    },
    memories: {
      package: "MEMORIES — ₹149",
      status: "Photos are included. After your order is submitted, we'll contact you on WhatsApp to collect them.",
      included: true,
      type: "photos_via_whatsapp"
    },
    cinematic: {
      package: "CINEMATIC — ₹199",
      status: "Photos + videos are included. After your order is submitted, we'll contact you on WhatsApp to collect them.",
      included: true,
      type: "photos_and_videos_via_whatsapp"
    }
  };

  const current = content[pkgId] || content.memories;

  if (selectedPackage) {
    selectedPackage.textContent = current.package;
  }

  if (noticeText) {
    noticeText.textContent = current.status;
  }

  if (statusText) {
    statusText.textContent = current.included
      ? "No uploads needed here."
      : "No uploads needed here — media is not included with this package.";
  }

  packageCards.forEach((card) => {
    const isSelected = card.dataset.mediaPackage === pkgId;
    card.classList.toggle("media-package-card--selected", isSelected);
    card.setAttribute("aria-current", isSelected ? "true" : "false");
  });

  ORDER.media = {
    mediaIncluded: current.included,
    mediaType: current.type
  };
}

function checkMediaPackageRules() {
  updateMediaInfo();
}


/* ============================================================
   VALIDATION
   ============================================================ */

function validateCurrentStep() {

  collectOrderData();


  if (
    currentStep === 1 &&
    !ORDER.occasion
  ) {

    showError(
      "error-step-1"
    );

    return false;

  }


  if (
    currentStep === 2 &&
    (
      !ORDER.recipient.name ||
      !ORDER.recipient.name.trim()
    )
  ) {

    showError(
      "error-recipient-name"
    );

    return false;

  }


  if (
    currentStep === 7 &&
    !ORDER.package.id
  ) {

    showError(
      "error-step-7"
    );

    return false;

  }


  if (
    currentStep === 8
  ) {

    if (
      !ORDER.delivery.customerName ||
      !ORDER.delivery.customerName.trim()
    ) {

      showError(
        "error-customer-name"
      );

      return false;

    }


    if (
      !ORDER.delivery.whatsapp ||
      !ORDER.delivery.whatsapp.trim()
    ) {

      showError(
        "error-customer-whatsapp"
      );

      return false;

    }

  }


  return true;

}


/* ============================================================
   ERROR HELPERS
   ============================================================ */

function showError(id) {

  const el =
    document.getElementById(
      id
    );


  if (el) {

    el.classList.add(
      "is-visible"
    );

  }

}


function hideError(id) {

  const el =
    document.getElementById(
      id
    );


  if (el) {

    el.classList.remove(
      "is-visible"
    );

  }

}


/* ============================================================
   DATA COLLECTION
   ============================================================ */

function collectOrderData() {

  const get = (id) => {

    const el =
      document.getElementById(
        id
      );

    return el
      ? el.value
      : "";

  };


  /* ------------------------------
     RECIPIENT
     ------------------------------ */

  ORDER.recipient.name =
    get("recipient-name");


  ORDER.recipient.personality =
    get(
      "recipient-personality"
    );


  ORDER.recipient.additionalInfo =
    get(
      "recipient-additional"
    );


  /* ------------------------------
     STORY
     ------------------------------ */

  ORDER.story.favoriteMemory =
    get(
      "story-memory"
    );


  ORDER.story.whySpecial =
    get(
      "story-special"
    );


  ORDER.story.insideJokes =
    get(
      "story-jokes"
    );


  ORDER.story.message =
    get(
      "story-message"
    );


  ORDER.story.additionalNotes =
    get(
      "story-notes"
    );


  /* ------------------------------
     DESIGN
     ------------------------------ */

  ORDER.design.specialRequests =
    get(
      "special-requests"
    );


  /* ------------------------------
     DELIVERY
     ------------------------------ */

  ORDER.delivery.customerName =
    get(
      "customer-name"
    );


  ORDER.delivery.whatsapp =
    get(
      "customer-whatsapp"
    );


  ORDER.delivery.email =
    get(
      "customer-email"
    );


  ORDER.delivery.deadline =
    get(
      "customer-deadline"
    );

}


/* ============================================================
   REVIEW SUMMARY
   ============================================================ */

function renderReviewSummary() {

  collectOrderData();


  const card =
    document.getElementById(
      "review-card"
    );


  if (!card) return;


  const mediaText =
    formatMediaSummary(
      ORDER.media
    );


  const pkg =
    PACKAGES[
      ORDER.package.id
    ] ||
    PACKAGES.memories;


  const packageLabel =
    pkg.formLabel;


  card.innerHTML = `

    <div class="review-item">

      <div class="review-item__content">

        <span class="review-item__label">
          Occasion
        </span>

        <span class="review-item__val">
          ${fv(ORDER.occasion)}
        </span>

      </div>

      <button
        type="button"
        class="btn-review-edit"
        onclick="goToStep(1)"
      >
        Edit
      </button>

    </div>


    <div class="review-item">

      <div class="review-item__content">

        <span class="review-item__label">
          Recipient & Relationship
        </span>

        <span class="review-item__val">
          ${fv(ORDER.recipient.name)}
          (${fv(ORDER.recipient.relationship)})
        </span>

      </div>

      <button
        type="button"
        class="btn-review-edit"
        onclick="goToStep(2)"
      >
        Edit
      </button>

    </div>


    <div class="review-item">

      <div class="review-item__content">

        <span class="review-item__label">
          Story & Message
        </span>

        <span class="review-item__val">
          ${fv(
            ORDER.story.message,
            "No message specified"
          )}
        </span>

      </div>

      <button
        type="button"
        class="btn-review-edit"
        onclick="goToStep(3)"
      >
        Edit
      </button>

    </div>


    <div class="review-item">

      <div class="review-item__content">

        <span class="review-item__label">
          Vibe & Feeling
        </span>

        <span class="review-item__val">

          ${formatArrayField(
            ORDER.feeling.moods
          )}

          • 

          ${
            INTENSITY_MAP[
              ORDER.feeling.intensity
            ]
          }

        </span>

      </div>

      <button
        type="button"
        class="btn-review-edit"
        onclick="goToStep(4)"
      >
        Edit
      </button>

    </div>


    <div class="review-item">

      <div class="review-item__content">

        <span class="review-item__label">
          Media
        </span>

        <span class="review-item__val">
          ${mediaText}
        </span>

      </div>

      <button
        type="button"
        class="btn-review-edit"
        onclick="goToStep(5)"
      >
        Edit
      </button>

    </div>


    <div class="review-item">

      <div class="review-item__content">

        <span class="review-item__label">
          Visual Style
        </span>

        <span class="review-item__val">

          ${fv(
            ORDER.design.style
          )}

          ${
            ORDER.design.colors.length
              ? `(${formatArrayField(
                  ORDER.design.colors
                )})`
              : ""
          }

        </span>

      </div>

      <button
        type="button"
        class="btn-review-edit"
        onclick="goToStep(6)"
      >
        Edit
      </button>

    </div>


    <div class="review-item">

      <div class="review-item__content">

        <span class="review-item__label">
          Package & Pricing
        </span>

        <span class="review-item__val">

          <strong>
            ${packageLabel}
          </strong>

          |

          Advance:
          ₹${ORDER.package.advance}

          |

          Remaining:
          ₹${ORDER.package.remaining}

        </span>

      </div>

      <button
        type="button"
        class="btn-review-edit"
        onclick="goToStep(7)"
      >
        Edit
      </button>

    </div>


    <div class="review-item">

      <div class="review-item__content">

        <span class="review-item__label">
          Delivery
        </span>

        <span class="review-item__val">

          ${fv(
            ORDER.delivery.customerName
          )}

          (${fv(
            ORDER.delivery.whatsapp
          )})

          via

          ${fv(
            ORDER.delivery.method
          )}

        </span>

      </div>

      <button
        type="button"
        class="btn-review-edit"
        onclick="goToStep(8)"
      >
        Edit
      </button>

    </div>

  `;

}


/* ============================================================
   FORMATTING HELPERS
   ============================================================ */

function formatArrayField(arr) {

  if (
    !arr ||
    !Array.isArray(arr) ||
    arr.length === 0
  ) {

    return "None selected";

  }


  return arr.join(
    ", "
  );

}


function formatMediaSummary(media) {
  const type = media?.mediaType || "none";

  if (type === "photos_via_whatsapp") {
    return "Photos via WhatsApp";
  }

  if (type === "photos_and_videos_via_whatsapp") {
    return "Photos + videos via WhatsApp";
  }

  return "No media included";
}

function fv(
  val,
  fallback = "None specified"
) {

  return (

    val &&
    String(val).trim() !== ""

  )

    ? escapeHtml(
        String(val)
      )

    : fallback;

}


/* ============================================================
   END
   ============================================================ */