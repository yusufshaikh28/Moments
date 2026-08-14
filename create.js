/* ============================================================
   MOMENT — create.js (clean 2-step)
   Document-level event delegation for reliable selection.
   ============================================================ */

const BACKEND_CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbxZP-Z7T4G5oQ8pApGSlg3G-rSoOQ7dqKIibsZ9fZi3jWgxo9M3Edz7vZtLWon6Z8JJ/exec"
};

const ORDER = {
  occasion: "",
  recipient: { name: "", relationship: "", personality: "", additionalInfo: "" },
  story: { favoriteMemory: "", whySpecial: "", insideJokes: "", message: "", additionalNotes: "" },
  feeling: { moods: [], desiredReaction: [], intensity: "3" },
  media: {
    photos: [],
    videos: [],
    mediaIncluded: true,
    mediaType: "photos_via_whatsapp"
  },
  design: { style: "", colors: [], specialRequests: "" },
  package: { id: "memories", name: "MEMORIES", total: 149, advance: 50, remaining: 99 },
  delivery: { customerName: "", whatsapp: "", email: "", deadline: "", method: "WhatsApp" }
};

const PACKAGES = {
  essential: { id: "essential", name: "ESSENTIAL", total: 99, advance: 50 },
  memories:  { id: "memories",  name: "MEMORIES",  total: 149, advance: 50 },
  cinematic: { id: "cinematic", name: "CINEMATIC", total: 199, advance: 50 }
};

/** Live Code.gs media contract — derived from package, never from uploads */
const MEDIA_BY_PACKAGE = {
  essential: { mediaIncluded: false, mediaType: "none" },
  memories:  { mediaIncluded: true,  mediaType: "photos_via_whatsapp" },
  cinematic: { mediaIncluded: true,  mediaType: "photos_and_videos_via_whatsapp" }
};

function syncMediaFromPackage(pkgId) {
  var id = (pkgId || "memories").toString().toLowerCase();
  var meta = MEDIA_BY_PACKAGE[id] || MEDIA_BY_PACKAGE.memories;
  ORDER.media.photos = [];
  ORDER.media.videos = [];
  ORDER.media.mediaIncluded = meta.mediaIncluded;
  ORDER.media.mediaType = meta.mediaType;
}

var currentStep = 1;
var TOTAL_STEPS = 2;
var DRAFT_KEY = "moment_draft_order_v2";
var isSubmitting = false;

document.addEventListener("DOMContentLoaded", function () {
  bindAllClicks();
  bindInputs();
  bindDraft();
  selectPackage(ORDER.package.id || "memories");
  updateStepUI();
  restoreDraftIfAny();
});

function bindAllClicks() {
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var occ = t.closest("[data-occasion]");
    if (occ && document.getElementById("occasion-options") && document.getElementById("occasion-options").contains(occ)) {
      e.preventDefault();
      var cards = document.querySelectorAll("#occasion-options [data-occasion]");
      for (var i = 0; i < cards.length; i++) cards[i].classList.remove("option-card--selected");
      occ.classList.add("option-card--selected");
      ORDER.occasion = occ.getAttribute("data-occasion") || "";
      hideError("error-occasion");
      saveDraft();
      return;
    }

    var rel = t.closest("[data-rel]");
    if (rel && document.getElementById("relationship-chips") && document.getElementById("relationship-chips").contains(rel)) {
      e.preventDefault();
      var chips = document.querySelectorAll("#relationship-chips [data-rel]");
      for (var j = 0; j < chips.length; j++) chips[j].classList.remove("chip-btn--selected");
      rel.classList.add("chip-btn--selected");
      ORDER.recipient.relationship = rel.getAttribute("data-rel") || "";
      hideError("error-relationship");
      saveDraft();
      return;
    }

    var pkg = t.closest("[data-package]");
    if (pkg && document.getElementById("packages-grid") && document.getElementById("packages-grid").contains(pkg)) {
      e.preventDefault();
      selectPackage(pkg.getAttribute("data-package"));
      saveDraft();
      return;
    }

    if (t.closest("#btn-next")) {
      e.preventDefault();
      if (currentStep === 1 && validateStep1()) goToStep(2);
      return;
    }

    if (t.closest("#btn-prev")) {
      e.preventDefault();
      if (currentStep > 1) goToStep(1);
      return;
    }

    if (t.closest("#btn-submit-order")) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (t.closest("#btn-retry-submit")) {
      e.preventDefault();
      var errEl = document.getElementById("submit-error-state");
      var readyEl = document.getElementById("submit-state-ready");
      if (errEl) errEl.classList.add("is-hidden");
      if (readyEl) readyEl.classList.remove("is-hidden");
      handleSubmit();
      return;
    }
  });
}

function bindInputs() {
  var recip = document.getElementById("recipient-name");
  if (recip) {
    recip.addEventListener("input", function () {
      ORDER.recipient.name = recip.value;
      hideError("error-recipient-name");
      saveDraft();
    });
  }
  var about = document.getElementById("about-them");
  if (about) {
    about.addEventListener("input", function () {
      ORDER.story.message = about.value;
      saveDraft();
    });
  }
  var cname = document.getElementById("customer-name");
  if (cname) {
    cname.addEventListener("input", function () {
      ORDER.delivery.customerName = cname.value;
      hideError("error-customer-name");
      saveDraft();
    });
  }
  var cwa = document.getElementById("customer-whatsapp");
  if (cwa) {
    cwa.addEventListener("input", function () {
      ORDER.delivery.whatsapp = cwa.value;
      hideError("error-customer-whatsapp");
      saveDraft();
    });
  }
}

function selectPackage(id) {
  var pkg = PACKAGES[id] || PACKAGES.memories;
  ORDER.package.id = pkg.id;
  ORDER.package.name = pkg.name;
  ORDER.package.total = pkg.total;
  ORDER.package.advance = pkg.advance;
  ORDER.package.remaining = pkg.total - pkg.advance;
  syncMediaFromPackage(pkg.id);

  var cards = document.querySelectorAll("[data-package]");
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].getAttribute("data-package") === pkg.id) {
      cards[i].classList.add("package-card--selected");
    } else {
      cards[i].classList.remove("package-card--selected");
    }
  }

  var t = document.getElementById("calc-total");
  var a = document.getElementById("calc-advance");
  var r = document.getElementById("calc-remaining");
  if (t) t.textContent = "₹" + ORDER.package.total;
  if (a) a.textContent = "₹" + ORDER.package.advance;
  if (r) r.textContent = "₹" + ORDER.package.remaining;
  hideError("error-package");
}

function goToStep(n) {
  if (n < 1 || n > TOTAL_STEPS) return;
  var steps = document.querySelectorAll(".form-step");
  for (var i = 0; i < steps.length; i++) steps[i].classList.remove("form-step--active");
  currentStep = n;
  var target = document.querySelector('.form-step[data-step="' + n + '"]');
  if (target) target.classList.add("form-step--active");
  updateStepUI();
  window.scrollTo(0, 0);
}

function updateStepUI() {
  var badge = document.getElementById("step-badge");
  if (badge) badge.textContent = (currentStep < 10 ? "0" : "") + currentStep + " / 0" + TOTAL_STEPS;

  var fill = document.getElementById("progress-fill");
  if (fill) fill.style.width = (currentStep / TOTAL_STEPS) * 100 + "%";

  var prev = document.getElementById("btn-prev");
  var next = document.getElementById("btn-next");
  var barText = document.getElementById("bar-step-text");
  if (prev) prev.style.visibility = currentStep > 1 ? "visible" : "hidden";
  if (next) next.style.display = currentStep >= TOTAL_STEPS ? "none" : "inline-flex";
  if (barText) barText.textContent = "Step " + currentStep + " of " + TOTAL_STEPS;

  var dots = document.getElementById("bar-dots");
  if (dots) {
    var h = "";
    for (var i = 1; i <= TOTAL_STEPS; i++) {
      var cls = "dot-step";
      if (i === currentStep) cls += " dot-step--active";
      else if (i < currentStep) cls += " dot-step--completed";
      h += '<span class="' + cls + '"></span>';
    }
    dots.innerHTML = h;
  }
}

function syncFromDom() {
  var recip = document.getElementById("recipient-name");
  if (recip) ORDER.recipient.name = recip.value.replace(/^\s+|\s+$/g, "");
  var about = document.getElementById("about-them");
  if (about) ORDER.story.message = about.value;
  var cname = document.getElementById("customer-name");
  if (cname) ORDER.delivery.customerName = cname.value.replace(/^\s+|\s+$/g, "");
  var cwa = document.getElementById("customer-whatsapp");
  if (cwa) ORDER.delivery.whatsapp = cwa.value.replace(/^\s+|\s+$/g, "");
}

function validateStep1() {
  syncFromDom();
  var ok = true;
  if (!ORDER.recipient.name) { showError("error-recipient-name"); ok = false; }
  if (!ORDER.occasion) { showError("error-occasion"); ok = false; }
  if (!ORDER.recipient.relationship) { showError("error-relationship"); ok = false; }
  return ok;
}

function validateStep2() {
  syncFromDom();
  var ok = true;
  if (!ORDER.delivery.customerName) { showError("error-customer-name"); ok = false; }
  if (!ORDER.delivery.whatsapp) { showError("error-customer-whatsapp"); ok = false; }
  if (!ORDER.package || !ORDER.package.id) { showError("error-package"); ok = false; }
  return ok;
}

function showError(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add("is-visible");
}
function hideError(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove("is-visible");
}

function bindDraft() {
  var restoreBtn = document.getElementById("btn-restore-draft");
  if (restoreBtn) {
    restoreBtn.addEventListener("click", function (e) {
      e.preventDefault();
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      try {
        applyDraft(JSON.parse(raw));
        var banner = document.getElementById("draft-banner");
        if (banner) banner.classList.add("is-hidden");
      } catch (err) {
        console.warn("[MOMENT] draft parse failed", err);
      }
    });
  }
  var discardBtn = document.getElementById("btn-discard-draft");
  if (discardBtn) {
    discardBtn.addEventListener("click", function (e) {
      e.preventDefault();
      localStorage.removeItem(DRAFT_KEY);
      var banner = document.getElementById("draft-banner");
      if (banner) banner.classList.add("is-hidden");
    });
  }
}

function saveDraft() {
  syncFromDom();
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(ORDER));
  } catch (err) {
    console.warn("[MOMENT] draft save failed", err);
  }
}

function restoreDraftIfAny() {
  var raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    var d = JSON.parse(raw);
    if (d && (d.occasion || (d.recipient && d.recipient.name) || (d.delivery && d.delivery.customerName))) {
      var banner = document.getElementById("draft-banner");
      if (banner) banner.classList.remove("is-hidden");
    }
  } catch (err) { /* ignore */ }
}

function applyDraft(d) {
  if (!d || typeof d !== "object") return;
  if (d.occasion != null) ORDER.occasion = d.occasion;
  if (d.recipient) {
    ORDER.recipient.name = d.recipient.name || "";
    ORDER.recipient.relationship = d.recipient.relationship || "";
    ORDER.recipient.personality = d.recipient.personality || "";
    ORDER.recipient.additionalInfo = d.recipient.additionalInfo || "";
  }
  if (d.story) ORDER.story.message = d.story.message || "";
  if (d.package) {
    ORDER.package.id = d.package.id || "memories";
    ORDER.package.name = d.package.name || "MEMORIES";
    ORDER.package.total = d.package.total || 149;
    ORDER.package.advance = d.package.advance || 50;
    ORDER.package.remaining = d.package.remaining != null ? d.package.remaining : 99;
  }
  if (d.delivery) {
    ORDER.delivery.customerName = d.delivery.customerName || "";
    ORDER.delivery.whatsapp = d.delivery.whatsapp || "";
  }

  var recip = document.getElementById("recipient-name");
  if (recip) recip.value = ORDER.recipient.name || "";
  var about = document.getElementById("about-them");
  if (about) about.value = ORDER.story.message || "";
  var cname = document.getElementById("customer-name");
  if (cname) cname.value = ORDER.delivery.customerName || "";
  var cwa = document.getElementById("customer-whatsapp");
  if (cwa) cwa.value = ORDER.delivery.whatsapp || "";

  var occCards = document.querySelectorAll("[data-occasion]");
  for (var i = 0; i < occCards.length; i++) {
    if (occCards[i].getAttribute("data-occasion") === ORDER.occasion) {
      occCards[i].classList.add("option-card--selected");
    } else {
      occCards[i].classList.remove("option-card--selected");
    }
  }
  var relChips = document.querySelectorAll("[data-rel]");
  for (var k = 0; k < relChips.length; k++) {
    if (relChips[k].getAttribute("data-rel") === ORDER.recipient.relationship) {
      relChips[k].classList.add("chip-btn--selected");
    } else {
      relChips[k].classList.remove("chip-btn--selected");
    }
  }
  selectPackage(ORDER.package.id || "memories");
}

function handleSubmit() {
  if (isSubmitting) return;
  if (!validateStep2()) return;

  syncMediaFromPackage(ORDER.package.id);

  isSubmitting = true;
  var btn = document.getElementById("btn-submit-order");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Submitting…";
  }

  submitOrderToBackend(ORDER)
    .then(function (result) {
      isSubmitting = false;
      localStorage.removeItem(DRAFT_KEY);
      showConfirmation(result.orderId);
    })
    .catch(function (err) {
      isSubmitting = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Submit Request →";
      }
      var msg = document.getElementById("error-message-text");
      if (msg) {
        msg.textContent = err && err.message
          ? "Submission failed: " + err.message + ". Your responses are safe."
          : "We couldn't send your request. Please try again.";
      }
      var ready = document.getElementById("submit-state-ready");
      var errState = document.getElementById("submit-error-state");
      if (ready) ready.classList.add("is-hidden");
      if (errState) errState.classList.remove("is-hidden");
    });
}

function submitOrderToBackend(order) {
  return new Promise(function (resolve, reject) {
    if (!BACKEND_CONFIG.endpoint) {
      reject(new Error("Backend endpoint is not configured."));
      return;
    }

    var payload = {
      occasion: order.occasion || "",
      recipient: {
        name: (order.recipient && order.recipient.name) || "",
        relationship: (order.recipient && order.recipient.relationship) || "",
        personality: "",
        additionalInfo: ""
      },
      story: {
        favoriteMemory: "",
        whySpecial: "",
        insideJokes: "",
        message: (order.story && order.story.message) || "",
        additionalNotes: ""
      },
      feeling: { moods: [], desiredReaction: [], intensity: "3" },
      // Live Code.gs matches mediaIncluded + mediaType to package.
      // It rejects media.photos / media.videos when they are arrays (even empty).
      // So the wire payload sends metadata only; files stay off the website.
      media: {
        mediaIncluded: !!(order.media && order.media.mediaIncluded),
        mediaType: (order.media && order.media.mediaType) || "none"
      },
      design: { style: "", colors: [], specialRequests: "" },
      package: {
        id: (order.package && order.package.id) || "memories",
        name: (order.package && order.package.name) || "MEMORIES",
        total: (order.package && order.package.total) || 149,
        advance: (order.package && order.package.advance) || 50,
        remaining: (order.package && order.package.remaining) || 99
      },
      delivery: {
        customerName: (order.delivery && order.delivery.customerName) || "",
        whatsapp: (order.delivery && order.delivery.whatsapp) || "",
        email: "",
        deadline: "",
        method: "WhatsApp"
      }
    };

    fetch(BACKEND_CONFIG.endpoint, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Network error (" + res.status + ")");
        return res.text();
      })
      .then(function (text) {
        var result;
        try { result = JSON.parse(text); }
        catch (e) { throw new Error("Unexpected server response."); }
        if (!result || result.success !== true) {
          throw new Error((result && result.message) || "Order was not accepted.");
        }
        if (!result.orderId) throw new Error("Server did not return an Order ID.");
        resolve({ orderId: result.orderId, message: result.message || "Order received" });
      })
      .catch(function (err) { reject(err); });
  });
}

function showConfirmation(orderId) {
  var ready = document.getElementById("submit-state-ready");
  var errState = document.getElementById("submit-error-state");
  if (ready) ready.classList.add("is-hidden");
  if (errState) errState.classList.add("is-hidden");

  var el = document.getElementById("confirmation-state");
  if (el) {
    el.innerHTML =
      '<div class="confirmation-card">' +
      '<div class="confirmation-icon">❤️</div>' +
      '<h2 class="confirmation-title">Your request is in. ❤️</h2>' +
      '<p class="confirmation-lead">Order ID: <strong>' + escapeHtml(orderId || "—") + "</strong></p>" +
      '<p class="confirmation-body">Your request is received. We\'ll reach you on WhatsApp for the next step, including any photos or videos needed for your package, and the ₹50 advance.<br>Payment Status: Pending</p>' +
      '<div class="confirmation-cta"><a href="index.html" class="btn btn--ghost">Return to Home</a></div>' +
      "</div>";
    el.classList.remove("is-hidden");
  }
  var bar = document.getElementById("create-bar");
  if (bar) bar.style.display = "none";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
