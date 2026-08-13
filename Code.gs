/**
 * ============================================================
 * MOMENT — Google Apps Script Backend
 * Orders + Google Sheets + Google Drive photo storage
 * ============================================================
 *
 * Deploy as a Web App.
 *
 * CONFIG:
 *   SPREADSHEET_ID = existing Moment orders spreadsheet
 *   SHEET_NAME     = Orders
 *   PARENT_FOLDER_ID = Google Drive parent folder for order folders
 *
 * PHOTO RULES:
 *   Essential  ₹99  -> photos NOT allowed
 *   Memories   ₹149 -> photos allowed
 *   Cinematic  ₹199 -> photos allowed
 *
 * Videos are intentionally not part of the system.
 * ============================================================
 */

const CONFIG = {
  SPREADSHEET_ID: "1SDgeHra6XpIZqDqE6gDlee9ODIaekGSKoq4zFjDtSd4",
  SHEET_NAME: "Orders",
  PARENT_FOLDER_ID: "13i0PC9t1faca5-4ZYxdeY7g4Rrusg2rH"
};

const PACKAGES = {
  essential: {
    id: "essential",
    name: "ESSENTIAL",
    total: 99,
    allowsPhotos: false
  },
  memories: {
    id: "memories",
    name: "MEMORIES",
    total: 149,
    allowsPhotos: true
  },
  cinematic: {
    id: "cinematic",
    name: "CINEMATIC",
    total: 199,
    allowsPhotos: true
  }
};

const REQUIRED_ADVANCE = 50;

const MEDIA_LIMITS = {
  maxPhotos: 10,
  maxPhotoSizeMB: 10,
  maxTotalPhotosMB: 25
};

const HEADERS = [
  "Timestamp",
  "Order ID",
  "Occasion",

  "Recipient Name",
  "Relationship",
  "Personality",
  "Additional Info",

  "Favorite Memory",
  "Why Special",
  "Inside Jokes",
  "Message",
  "Additional Notes",

  "Moods",
  "Desired Reaction",
  "Intensity",

  "Photo Count",
  "Media Summary",

  "Style",
  "Colors",
  "Special Requests",
  "Additional Design Notes",

  "Package",
  "Package Total",
  "Advance",
  "Remaining",

  "Customer Name",
  "WhatsApp",
  "Email",
  "Deadline",
  "Delivery Method",

  "Payment Status",
  "Payment ID",
  "Order Status",

  "Submission Key",
  "Media Folder",
  "Photo URLs"
];

/* ============================================================
   GET
   ============================================================ */

function doGet() {
  return jsonResponse({
    success: true,
    message: "Moment order backend is running."
  });
}

/* ============================================================
   POST
   ============================================================ */

function doPost(e) {
  let lock;

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        success: false,
        message: "No data received."
      });
    }

    let order;

    try {
      order = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({
        success: false,
        message: "Invalid JSON payload."
      });
    }

    const validation = validateOrder(order);

    if (!validation.valid) {
      return jsonResponse({
        success: false,
        message: validation.reason
      });
    }

    const sheet = getOrdersSheet();

    const submissionKey =
      String(order.submissionKey || "").trim();

    /*
     * Duplicate protection before acquiring the lock.
     */
    if (submissionKey) {
      const existing = findOrderBySubmissionKey(
        sheet,
        submissionKey
      );

      if (existing) {
        return jsonResponse({
          success: true,
          duplicate: true,
          orderId: existing.orderId,
          folderUrl: existing.folderUrl || "",
          photoUrls: existing.photoUrls || [],
          message: "Order already received."
        });
      }
    }

    lock = LockService.getScriptLock();

    if (!lock.tryLock(15000)) {
      return jsonResponse({
        success: false,
        message: "Server is busy. Please try again."
      });
    }

    /*
     * Recheck after obtaining lock.
     */
    if (submissionKey) {
      const existingLocked = findOrderBySubmissionKey(
        sheet,
        submissionKey
      );

      if (existingLocked) {
        return jsonResponse({
          success: true,
          duplicate: true,
          orderId: existingLocked.orderId,
          folderUrl: existingLocked.folderUrl || "",
          photoUrls: existingLocked.photoUrls || [],
          message: "Order already received."
        });
      }
    }

    const pkg = PACKAGES[order.package.id];

    /*
     * Server-side pricing source of truth.
     */
    const total = pkg.total;
    const advance = REQUIRED_ADVANCE;
    const remaining = total - advance;

    const orderId = generateOrderId(sheet);
    const timestamp = new Date();

    /*
     * Upload actual photos first.
     * If photo upload fails, do not write a fake successful row.
     */
    const mediaResult = uploadPhotosIfNeeded(
      order.media && Array.isArray(order.media.photos)
        ? order.media.photos
        : [],
      orderId,
      pkg
    );

    const row = buildRow({
      timestamp,
      orderId,
      order,
      pkg,
      total,
      advance,
      remaining,
      mediaResult
    });

    sheet.appendRow(row);

    return jsonResponse({
      success: true,
      orderId,
      folderUrl: mediaResult.folderUrl || "",
      photoUrls: mediaResult.photoUrls || [],
      message: "Order received successfully."
    });

  } catch (err) {
    console.error(err && err.stack ? err.stack : err);

    return jsonResponse({
      success: false,
      message:
        err && err.message
          ? err.message
          : "Server error while processing order."
    });

  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (_) {}
    }
  }
}

/* ============================================================
   VALIDATION
   ============================================================ */

function validateOrder(order) {
  if (!order || typeof order !== "object") {
    return {
      valid: false,
      reason: "Order payload is missing or malformed."
    };
  }

  if (!String(order.occasion || "").trim()) {
    return {
      valid: false,
      reason: "Occasion is required."
    };
  }

  if (
    !order.recipient ||
    !String(order.recipient.name || "").trim()
  ) {
    return {
      valid: false,
      reason: "Recipient name is required."
    };
  }

  if (
    !order.delivery ||
    !String(order.delivery.customerName || "").trim()
  ) {
    return {
      valid: false,
      reason: "Customer name is required."
    };
  }

  if (
    !order.delivery ||
    !String(order.delivery.whatsapp || "").trim()
  ) {
    return {
      valid: false,
      reason: "WhatsApp number is required."
    };
  }

  if (
    !order.package ||
    !PACKAGES[order.package.id]
  ) {
    return {
      valid: false,
      reason: "Invalid package selection."
    };
  }

  const pkg = PACKAGES[order.package.id];

  const photos =
    order.media &&
    Array.isArray(order.media.photos)
      ? order.media.photos
      : [];

  /*
   * Single authoritative photo/package rule.
   */
  if (photos.length > 0 && !pkg.allowsPhotos) {
    return {
      valid: false,
      reason:
        "Photos are not included with Essential. Please select Memories or Cinematic."
    };
  }

  if (photos.length > MEDIA_LIMITS.maxPhotos) {
    return {
      valid: false,
      reason:
        "Maximum " +
        MEDIA_LIMITS.maxPhotos +
        " photos are allowed."
    };
  }

  let totalBytes = 0;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];

    if (!photo || !photo.data) {
      return {
        valid: false,
        reason:
          "Photo " +
          (i + 1) +
          " was not received correctly."
      };
    }

    const mimeType = String(
      photo.mimeType ||
      photo.type ||
      ""
    ).toLowerCase();

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ];

    if (allowedTypes.indexOf(mimeType) === -1) {
      return {
        valid: false,
        reason:
          "Unsupported image type for photo " +
          (i + 1) +
          "."
      };
    }

    const size =
      Number(photo.size) ||
      estimateBase64Size(photo.data);

    const maxPhotoBytes =
      MEDIA_LIMITS.maxPhotoSizeMB * 1024 * 1024;

    if (size > maxPhotoBytes) {
      return {
        valid: false,
        reason:
          "Photo " +
          (i + 1) +
          " exceeds the " +
          MEDIA_LIMITS.maxPhotoSizeMB +
          " MB limit."
      };
    }

    totalBytes += size;
  }

  const maxTotalBytes =
    MEDIA_LIMITS.maxTotalPhotosMB * 1024 * 1024;

  if (totalBytes > maxTotalBytes) {
    return {
      valid: false,
      reason:
        "Total photo size exceeds " +
        MEDIA_LIMITS.maxTotalPhotosMB +
        " MB."
    };
  }

  return {
    valid: true
  };
}

/* ============================================================
   GOOGLE SHEET
   ============================================================ */

function getOrdersSheet() {
  const ss = SpreadsheetApp.openById(
    CONFIG.SPREADSHEET_ID
  );

  let sheet = ss.getSheetByName(
    CONFIG.SHEET_NAME
  );

  if (!sheet) {
    sheet = ss.insertSheet(
      CONFIG.SHEET_NAME
    );
  }

  ensureHeaders(sheet);

  return sheet;
}

function ensureHeaders(sheet) {
  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      HEADERS.length
    );

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, HEADERS.length)
      .setValues([HEADERS]);

    sheet
      .getRange(1, 1, 1, HEADERS.length)
      .setFontWeight("bold");

    sheet.setFrozenRows(1);

    return;
  }

  const existing =
    sheet
      .getRange(1, 1, 1, lastColumn)
      .getValues()[0];

  /*
   * Only add missing headers.
   * Never destroy/reorder existing order data.
   */
  HEADERS.forEach((header) => {
    if (existing.indexOf(header) === -1) {
      sheet
        .getRange(1, sheet.getLastColumn() + 1)
        .setValue(header);
    }
  });

  sheet.setFrozenRows(1);
}

/* ============================================================
   DUPLICATE CHECK
   ============================================================ */

function findOrderBySubmissionKey(
  sheet,
  submissionKey
) {
  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0];

  const keyCol =
    headers.indexOf("Submission Key") + 1;

  if (keyCol <= 0) return null;

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) return null;

  const values =
    sheet
      .getRange(
        2,
        keyCol,
        lastRow - 1,
        1
      )
      .getValues();

  for (let i = 0; i < values.length; i++) {
    if (
      String(values[i][0] || "") ===
      submissionKey
    ) {
      const row = i + 2;

      const orderIdCol =
        headers.indexOf("Order ID") + 1;

      const folderCol =
        headers.indexOf("Media Folder") + 1;

      const photoUrlCol =
        headers.indexOf("Photo URLs") + 1;

      return {
        orderId:
          orderIdCol > 0
            ? sheet.getRange(row, orderIdCol).getValue()
            : "",

        folderUrl:
          folderCol > 0
            ? sheet.getRange(row, folderCol).getValue()
            : "",

        photoUrls:
          photoUrlCol > 0
            ? String(
                sheet.getRange(row, photoUrlCol).getValue() || ""
              )
                .split("\n")
                .filter(Boolean)
            : []
      };
    }
  }

  return null;
}

/* ============================================================
   ORDER ID
   ============================================================ */

function generateOrderId(sheet) {
  const tz =
    Session.getScriptTimeZone() ||
    "Etc/UTC";

  const datePart =
    Utilities.formatDate(
      new Date(),
      tz,
      "yyyyMMdd"
    );

  const existing =
    getExistingOrderIds(sheet);

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate =
      "MOM-" +
      datePart +
      "-" +
      generateRandomCode(4);

    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Could not generate a unique Order ID."
  );
}

function getExistingOrderIds(sheet) {
  const set = new Set();

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) return set;

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0];

  const orderIdCol =
    headers.indexOf("Order ID") + 1;

  if (orderIdCol <= 0) return set;

  const values =
    sheet
      .getRange(
        2,
        orderIdCol,
        lastRow - 1,
        1
      )
      .getValues();

  values.forEach((row) => {
    if (row[0]) {
      set.add(String(row[0]));
    }
  });

  return set;
}

function generateRandomCode(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return result;
}

/* ============================================================
   GOOGLE DRIVE PHOTO STORAGE
   ============================================================ */

function getParentFolder() {
  return DriveApp.getFolderById(
    CONFIG.PARENT_FOLDER_ID
  );
}

function createOrderFolder(orderId) {
  return getParentFolder().createFolder(
    orderId
  );
}

function uploadPhotosIfNeeded(
  photos,
  orderId,
  pkg
) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return {
      folder: null,
      folderUrl: "",
      photoUrls: []
    };
  }

  if (!pkg.allowsPhotos) {
    throw new Error(
      "Photos are not included with Essential. Please select Memories or Cinematic."
    );
  }

  const folder =
    createOrderFolder(orderId);

  const photoUrls = [];

  try {
    photos.forEach((photo, index) => {
      const base64 =
        extractBase64(photo.data);

      const bytes =
        Utilities.base64Decode(base64);

      const mimeType =
        String(
          photo.mimeType ||
          photo.type ||
          ""
        ).toLowerCase();

      const filename =
        sanitizeFilename(
          photo.name ||
          `photo-${index + 1}.jpg`
        );

      const blob =
        Utilities.newBlob(
          bytes,
          mimeType,
          filename
        );

      const file =
        folder.createFile(blob);

      photoUrls.push(
        file.getUrl()
      );
    });

  } catch (err) {
    /*
     * Do not leave orphaned media folders when the
     * photo upload fails.
     */
    try {
      folder.setTrashed(true);
    } catch (_) {}

    throw err;
  }

  return {
    folder,
    folderUrl: folder.getUrl(),
    photoUrls
  };
}

function extractBase64(data) {
  const value = String(data || "");
  const comma = value.indexOf(",");

  return comma >= 0
    ? value.substring(comma + 1)
    : value;
}

function sanitizeFilename(name) {
  return String(name)
    .replace(/[\\/:*?"<>|#%{}]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 180) ||
    "uploaded-photo";
}

function estimateBase64Size(data) {
  const base64 =
    extractBase64(data);

  return Math.floor(
    (base64.length * 3) / 4
  );
}

/* ============================================================
   BUILD SHEET ROW
   ============================================================ */

function buildRow(params) {
  const order = params.order;

  const recipient =
    order.recipient || {};

  const story =
    order.story || {};

  const feeling =
    order.feeling || {};

  const media =
    order.media || {};

  const design =
    order.design || {};

  const delivery =
    order.delivery || {};

  const photoCount =
    Array.isArray(media.photos)
      ? media.photos.length
      : 0;

  const mediaSummary =
    photoCount === 0
      ? "No media"
      : `${photoCount} photo${
          photoCount !== 1 ? "s" : ""
        }`;

  const packageLabel =
    params.pkg.name +
    " — ₹" +
    params.total;

  return [
    Utilities.formatDate(
      params.timestamp,
      Session.getScriptTimeZone() || "Etc/UTC",
      "yyyy-MM-dd HH:mm:ss"
    ),

    params.orderId,

    order.occasion || "",

    recipient.name || "",
    recipient.relationship || "",
    recipient.personality || "",
    recipient.additionalInfo || "",

    story.favoriteMemory || "",
    story.whySpecial || "",
    story.insideJokes || "",
    story.message || "",
    story.additionalNotes || "",

    arrayToString(feeling.moods),
    arrayToString(feeling.desiredReaction),
    intensityLabel(feeling.intensity),

    photoCount,
    mediaSummary,

    design.style || "",
    arrayToString(design.colors),
    design.specialRequests || "",
    design.additionalDesignNotes || "",

    packageLabel,
    params.total,
    "₹" + params.advance,
    "₹" + params.remaining,

    delivery.customerName || "",
    delivery.whatsapp || "",
    delivery.email || "",
    delivery.deadline || "",
    delivery.method || "",

    "Pending",
    "",
    "New",

    order.submissionKey || "",

    params.mediaResult.folderUrl || "",

    (params.mediaResult.photoUrls || []).join("\n")
  ];
}

/* ============================================================
   HELPERS
   ============================================================ */

function arrayToString(value) {
  return Array.isArray(value)
    ? value.join(", ")
    : String(value || "");
}

function intensityLabel(value) {
  const labels = {
    "1": "Subtle & Gentle",
    "2": "Soft & Meaningful",
    "3": "Balanced & Heartfelt",
    "4": "Strong Emotional Impact",
    "5": "FULL EMOTIONAL DAMAGE"
  };

  return (
    labels[String(value)] ||
    String(value || "3")
  );
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}
