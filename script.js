"use strict";

/* =========================================================
   NAOL 3D SMART RULER
   Part 3 of 3 — Complete JavaScript
   Camera, Photo Measurement, Calibration and Unit Converter
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);

    /* =====================================================
       ELEMENTS
       ===================================================== */

    const systemStatus = $("systemStatus");

    const startCameraBtn = $("startCameraBtn");
    const uploadTriggerBtn = $("uploadTriggerBtn");
    const photoInput = $("photoInput");
    const cameraPlaceholderBtn = $("cameraPlaceholderBtn");
    const stopCameraBtn = $("stopCameraBtn");

    const studioTitle = $("studioTitle");
    const studioDescription = $("studioDescription");

    const cameraFrame = $("cameraFrame");
    const cameraPlaceholder = $("cameraPlaceholder");
    const cameraVideo = $("cameraVideo");
    const uploadedImage = $("uploadedImage");
    const measurementCanvas = $("measurementCanvas");
    const cameraOverlay = $("cameraOverlay");

    const changePhotoBtn = $("changePhotoBtn");
    const clearPointsBtn = $("clearPointsBtn");
    const measurementInstructions = $("measurementInstructions");

    const referenceLength = $("referenceLength");
    const referenceUnit = $("referenceUnit");
    const calibrateBtn = $("calibrateBtn");
    const calibrationMessage = $("calibrationMessage");

    const resultValue = $("resultValue");
    const resultUnit = $("resultUnit");
    const resultExplanation = $("resultExplanation");

    const startPointResult = $("startPointResult");
    const endPointResult = $("endPointResult");
    const pixelDistanceResult = $("pixelDistanceResult");

    const horizontalDistance = $("horizontalDistance");
    const viewingAngle = $("viewingAngle");
    const observerHeight = $("observerHeight");

    const calculateHeightBtn = $("calculateHeightBtn");
    const heightCalculatorResult = $("heightCalculatorResult");
    const calculatedHeight = $("calculatedHeight");
    const heightCalculatorMessage = $("heightCalculatorMessage");

    const convertValue = $("convertValue");
    const convertFrom = $("convertFrom");
    const convertTo = $("convertTo");
    const swapUnitsBtn = $("swapUnitsBtn");
    const conversionResult = $("conversionResult");

    const currentYear = $("currentYear");

    /* =====================================================
       STATE
       ===================================================== */

    let cameraStream = null;

    let currentMode = "empty";
    let currentTool = "photo";

    let photoReady = false;
    let photoPoints = [];

    // Number of meters represented by one image pixel.
    let metersPerPixel = null;

    // Last measured length, stored in meters.
    let lastMeasuredMeters = null;

    let currentObjectUrl = null;

    /* =====================================================
       UNIT CONVERSION DATA
       All units are converted through meters.
       ===================================================== */

    const UNIT_TO_METERS = {
        mm: 0.001,
        cm: 0.01,
        m: 1,
        ft: 0.3048,
        in: 0.0254
    };

    const UNIT_LABELS = {
        mm: "mm",
        cm: "cm",
        m: "m",
        ft: "ft",
        in: "in"
    };

    /* =====================================================
       GENERAL HELPERS
       ===================================================== */

    function setStatus(message, type = "ready") {
        if (!systemStatus) return;

        systemStatus.textContent = message;

        systemStatus.classList.remove(
            "status-ready",
            "status-active",
            "status-error",
            "status-warning"
        );

        systemStatus.classList.add("status-" + type);
        systemStatus.setAttribute("aria-live", "polite");
    }

    function setText(element, text) {
        if (element) {
            element.textContent = String(text);
        }
    }

    function formatNumber(value, decimals = 3) {
        if (!Number.isFinite(value)) return "—";

        return Number(value.toFixed(decimals)).toLocaleString(
            undefined,
            {
                maximumFractionDigits: decimals
            }
        );
    }

    function showMessage(element, message, type = "") {
        if (!element) return;

        element.textContent = message;

        element.classList.remove(
            "success",
            "error",
            "warning"
        );

        if (type) {
            element.classList.add(type);
        }
    }

    function scrollToStudio() {
        const target = cameraFrame || studioTitle;

        if (target) {
            target.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }

    function metersToUnit(meters, unit) {
        const factor = UNIT_TO_METERS[unit];

        if (!factor || !Number.isFinite(meters)) {
            return NaN;
        }

        return meters / factor;
    }

    function unitToMeters(value, unit) {
        const factor = UNIT_TO_METERS[unit];

        if (!factor || !Number.isFinite(value)) {
            return NaN;
        }

        return value * factor;
    }

    function getSelectedResultUnit() {
        if (!resultUnit) return "m";

        const selected = String(resultUnit.value || "m")
            .toLowerCase()
            .trim();

        return UNIT_TO_METERS[selected] ? selected : "m";
    }

    /* =====================================================
       RESULT DISPLAY
       ===================================================== */

    function displayMeasurement(meters, explanation) {
        if (!Number.isFinite(meters) || meters < 0) {
            setText(resultValue, "—");
            setText(resultExplanation, "Safartuun sirrii hin taane.");
            return;
        }

        lastMeasuredMeters = meters;

        const unit = getSelectedResultUnit();
        const converted = metersToUnit(meters, unit);

        setText(resultValue, formatNumber(converted, 4));
        setText(resultExplanation, explanation);
    }

    function refreshDisplayedMeasurement() {
        if (lastMeasuredMeters === null) return;

        displayMeasurement(
            lastMeasuredMeters,
            resultExplanation
                ? resultExplanation.textContent
                : "Safartuu xumurame."
        );
    }

    /* =====================================================
       CAMERA CONTROL
       ===================================================== */

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach((track) => {
                track.stop();
            });

            cameraStream = null;
        }

        if (cameraVideo) {
            cameraVideo.pause();
            cameraVideo.srcObject = null;
            cameraVideo.style.display = "none";
        }

        if (cameraOverlay) {
            cameraOverlay.style.display = "none";
        }

        if (stopCameraBtn) {
            stopCameraBtn.style.display = "none";
        }

        if (currentMode === "camera") {
            currentMode = photoReady ? "photo" : "empty";
        }

        if (photoReady) {
            showPhotoCanvas();
        } else {
            showPlaceholder();
        }
    }

    async function startCamera() {
        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {

            setStatus("Camera browser kana irratti hin deeggaramu.", "error");

            showMessage(
                measurementInstructions,
                "Camera fayyadamuuf browser camera deeggaru fi HTTPS barbaachisa. Suuraa upload gochuunis ni danda'ama.",
                "error"
            );

            return;
        }

        stopCamera();

        setStatus("Camera banuuf yaalaa jira...", "warning");

        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: {
                        ideal: "environment"
                    },
                    width: {
                        ideal: 1920
                    },
                    height: {
                        ideal: 1080
                    }
                },
                audio: false
            });

            if (!cameraVideo) {
                throw new Error("Video element hin argamne.");
            }

            cameraVideo.srcObject = cameraStream;
            cameraVideo.style.display = "block";

            if (uploadedImage) {
                uploadedImage.style.display = "none";
            }

            if (measurementCanvas) {
                measurementCanvas.style.display = "none";
            }

            if (cameraPlaceholder) {
                cameraPlaceholder.style.display = "none";
            }

            if (cameraOverlay) {
                cameraOverlay.style.display = "block";
            }

            if (stopCameraBtn) {
                stopCameraBtn.style.display = "inline-flex";
            }

            currentMode = "camera";

            await cameraVideo.play();

            setStatus("Camera hojii irra jira", "active");

            setText(studioTitle, "Live Camera");
            setText(
                studioDescription,
                "Suuraa yeroo ammaa arguu dandeessa. Safartuu sirrii argachuuf reference ykn fageenya beekamaa fayyadami."
            );

            showMessage(
                measurementInstructions,
                "Camera amma banameera. Kun live view dha; dheerina dhugaa ofumaan hin safaru. Safartuu suuraa irratti gochuuf suuraa upload godhi.",
                "warning"
            );

            scrollToStudio();

        } catch (error) {
            console.error("Camera error:", error);

            if (cameraStream) {
                cameraStream.getTracks().forEach((track) => {
                    track.stop();
                });

                cameraStream = null;
            }

            if (cameraVideo) {
                cameraVideo.srcObject = null;
                cameraVideo.style.display = "none";
            }

            if (cameraOverlay) {
                cameraOverlay.style.display = "none";
            }

            if (stopCameraBtn) {
                stopCameraBtn.style.display = "none";
            }

            currentMode = photoReady ? "photo" : "empty";

            if (photoReady) {
                showPhotoCanvas();
            } else {
                showPlaceholder();
            }

            setStatus("Camera banuun hin danda'amne.", "error");

            let message =
                "Camera hin banamne. Permission camera kenni ykn suuraa upload godhi.";

            if (error && error.name === "NotAllowedError") {
                message =
                    "Camera permission dhoorkameera. Browser settings keessatti camera eeyyami.";
            } else if (error && error.name === "NotFoundError") {
                message =
                    "Camera hin argamne. Bilbila kee irratti camera jiraachuu mirkaneessi.";
            } else if (error && error.name === "NotReadableError") {
                message =
                    "Camera app biraan fayyadamaa jiraachuu danda'a. App sana cufiitii irra deebi'i.";
            }

            showMessage(
                measurementInstructions,
                message,
                "error"
            );
        }
    }

    /* =====================================================
       PLACEHOLDER DISPLAY
       ===================================================== */

    function showPlaceholder() {
        if (cameraVideo) {
            cameraVideo.style.display = "none";
        }

        if (uploadedImage) {
            uploadedImage.style.display = "none";
        }

        if (measurementCanvas) {
            measurementCanvas.style.display = "none";
        }

        if (cameraOverlay) {
            cameraOverlay.style.display = "none";
        }

        if (cameraPlaceholder) {
            cameraPlaceholder.style.display = "flex";
        }

        if (stopCameraBtn) {
            stopCameraBtn.style.display = "none";
        }
    }

    /* =====================================================
       PHOTO CANVAS SETUP
       ===================================================== */

    function showPhotoCanvas() {
        if (!photoReady || !measurementCanvas || !cameraFrame) {
            showPlaceholder();
            return;
        }

        if (cameraVideo) {
            cameraVideo.style.display = "none";
        }

        if (uploadedImage) {
            uploadedImage.style.display = "none";
        }

        if (cameraPlaceholder) {
            cameraPlaceholder.style.display = "none";
        }

        if (cameraOverlay) {
            cameraOverlay.style.display = "none";
        }

        measurementCanvas.style.display = "block";

        if (stopCameraBtn) {
            stopCameraBtn.style.display = "none";
        }

        currentMode = "photo";

        drawPhotoCanvas();
    }

    function drawPhotoCanvas() {
        if (!photoReady ||
            !measurementCanvas ||
            !uploadedImage ||
            !uploadedImage.naturalWidth ||
            !uploadedImage.naturalHeight) {
            return;
        }

        const canvas = measurementCanvas;
        const context = canvas.getContext("2d");

        if (!context) return;

        const imageWidth = uploadedImage.naturalWidth;
        const imageHeight = uploadedImage.naturalHeight;

        // Use original photo resolution for coordinate accuracy.
        if (canvas.width !== imageWidth) {
            canvas.width = imageWidth;
        }

        if (canvas.height !== imageHeight) {
            canvas.height = imageHeight;
        }

        // Match the frame ratio to the original image.
        cameraFrame.style.aspectRatio =
            imageWidth + " / " + imageHeight;

        cameraFrame.style.minHeight = "0";
        cameraFrame.style.height = "auto";

        context.clearRect(0, 0, canvas.width, canvas.height);

        context.drawImage(
            uploadedImage,
            0,
            0,
            imageWidth,
            imageHeight
        );

        // Draw line between selected points.
        if (photoPoints.length >= 2) {
            const first = photoPoints[0];
            const second = photoPoints[1];

            context.save();

            context.beginPath();
            context.moveTo(first.x, first.y);
            context.lineTo(second.x, second.y);

            context.lineWidth = Math.max(
                3,
                imageWidth / 500
            );

            context.strokeStyle = "#00e5ff";
            context.stroke();

            context.restore();
        }

        // Draw point markers.
        photoPoints.forEach((point, index) => {
            context.save();

            const radius = Math.max(
                7,
                imageWidth / 150
            );

            context.beginPath();
            context.arc(
                point.x,
                point.y,
                radius,
                0,
                Math.PI * 2
            );

            context.fillStyle =
                index === 0 ? "#00e5ff" : "#ffb84d";

            context.fill();

            context.lineWidth = Math.max(
                2,
                imageWidth / 800
            );

            context.strokeStyle = "#ffffff";
            context.stroke();

            context.font =
                "bold " + Math.max(18, imageWidth / 35) + "px Arial";

            context.fillStyle = "#ffffff";

            context.fillText(
                index === 0 ? "A" : "B",
                point.x + radius * 1.5,
                point.y - radius * 1.5
            );

            context.restore();
        });
    }

    /* =====================================================
       PHOTO UPLOAD
       ===================================================== */

    function openPhotoPicker() {
        if (photoInput) {
            photoInput.click();
        }
    }

    function handlePhotoUpload(event) {
        const file = event.target.files &&
                     event.target.files[0];

        if (!file) return;

        if (!file.type || !file.type.startsWith("image/")) {
            setStatus("Faayiliin filatame suuraa miti.", "error");

            showMessage(
                measurementInstructions,
                "Maaloo JPG, PNG, WEBP ykn suuraa biraa filadhu.",
                "error"
            );

            event.target.value = "";
            return;
        }

        stopCamera();

        photoReady = false;
        photoPoints = [];
        metersPerPixel = null;
        lastMeasuredMeters = null;

        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = null;
        }

        const objectUrl = URL.createObjectURL(file);
        currentObjectUrl = objectUrl;

        if (!uploadedImage) {
            setStatus("Image element hin argamne.", "error");
            return;
        }

        uploadedImage.onload = () => {
            photoReady = true;
            currentMode = "photo";

            photoPoints = [];
            metersPerPixel = null;
            lastMeasuredMeters = null;

            if (cameraFrame) {
                cameraFrame.style.aspectRatio =
                    uploadedImage.naturalWidth +
                    " / " +
                    uploadedImage.naturalHeight;

                cameraFrame.style.minHeight = "0";
                cameraFrame.style.height = "auto";
            }

            setText(studioTitle, "Photo Measurement");

            setText(
                studioDescription,
                "Suuraa irratti tuqaawwan filadhu. Reference beekamaa kalibreessuun wantoota biroo safaruu dandeessa."
            );

            setText(resultValue, "—");
            setText(pixelDistanceResult, "—");
            setText(startPointResult, "—");
            setText(endPointResult, "—");

            showPhotoCanvas();

            setStatus("Suuraan fe'ameera", "active");

            showMessage(
                measurementInstructions,
                "Jalqaba wanta dheerinni isaa duraan beekamu filadhu. Tuqaa A fi B irratti tuqi; dheerina dhugaa isaa galchiitii Calibrate tuqi. Sana booda wanta safaruu barbaaddu irratti tuqaawwan lama filadhu.",
                "success"
            );

            showMessage(
                calibrationMessage,
                "Reference length hin kalibreessine.",
                ""
            );

            scrollToStudio();
        };

        uploadedImage.onerror = () => {
            photoReady = false;

            setStatus("Suuraa banuun hin danda'amne.", "error");

            showMessage(
                measurementInstructions,
                "Suuraa kana banuun hin danda'amne. Suuraa biraa filadhu.",
                "error"
            );

            showPlaceholder();
        };

        uploadedImage.src = objectUrl;
    }

    /* =====================================================
       PHOTO POINT SELECTION
       ===================================================== */

    function getCanvasPoint(event) {
        if (!measurementCanvas) return null;

        const rect = measurementCanvas.getBoundingClientRect();

        if (!rect.width || !rect.height) return null;

        const scaleX = measurementCanvas.width / rect.width;
        const scaleY = measurementCanvas.height / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        return {
            x: Math.max(
                0,
                Math.min(measurementCanvas.width, x)
            ),
            y: Math.max(
                0,
                Math.min(measurementCanvas.height, y)
            )
        };
    }

    function calculatePixelDistance(pointA, pointB) {
        const dx = pointB.x - pointA.x;
        const dy = pointB.y - pointA.y;

        return Math.sqrt(dx * dx + dy * dy);
    }

    function updatePointInformation() {
        if (photoPoints.length >= 1) {
            setText(
                startPointResult,
                "(" +
                formatNumber(photoPoints[0].x, 1) +
                ", " +
                formatNumber(photoPoints[0].y, 1) +
                ")"
            );
        } else {
            setText(startPointResult, "—");
        }

        if (photoPoints.length >= 2) {
            setText(
                endPointResult,
                "(" +
                formatNumber(photoPoints[1].x, 1) +
                ", " +
                formatNumber(photoPoints[1].y, 1) +
                ")"
            );

            const pixels = calculatePixelDistance(
                photoPoints[0],
                photoPoints[1]
            );

            setText(
                pixelDistanceResult,
                formatNumber(pixels, 2) + " px"
            );
        } else {
            setText(endPointResult, "—");
            setText(pixelDistanceResult, "—");
        }
    }

    function handleCanvasClick(event) {
        if (!photoReady || currentMode !== "photo") {
            return;
        }

        const point = getCanvasPoint(event);

        if (!point) return;

        if (photoPoints.length >= 2) {
            photoPoints = [];
        }

        photoPoints.push(point);

        drawPhotoCanvas();
        updatePointInformation();

        if (photoPoints.length === 1) {
            showMessage(
                measurementInstructions,
                "Tuqaa A filatameera. Amma tuqaa B filadhu.",
                ""
            );
        } else {
            showMessage(
                measurementInstructions,
                "Tuqaawwan A fi B filatamaniiru. Reference beekamaa kalibreessuuf dheerina dhugaa galchiitii Calibrate tuqi.",
                "success"
            );
        }
    }

    function clearPhotoPoints() {
        photoPoints = [];

        drawPhotoCanvas();
        updatePointInformation();

        setText(pixelDistanceResult, "—");

        showMessage(
            measurementInstructions,
            metersPerPixel !== null
                ? "Calibration jira. Amma wanta safaruu barbaaddu irratti tuqaawwan lama filadhu."
                : "Tuqaawwan lama suuraa irratti filadhu.",
            ""
        );
    }

    /* =====================================================
       CALIBRATION AND PHOTO MEASUREMENT
       ===================================================== */

    function handleCalibrationOrMeasurement() {
        if (!photoReady) {
            showMessage(
                calibrationMessage,
                "Jalqaba suuraa upload godhi.",
                "error"
            );
            return;
        }

        if (photoPoints.length !== 2) {
            showMessage(
                calibrationMessage,
                "Safaruuf suuraa irratti tuqaawwan lama filadhu.",
                "error"
            );
            return;
        }

        const pixels = calculatePixelDistance(
            photoPoints[0],
            photoPoints[1]
        );

        if (!Number.isFinite(pixels) || pixels <= 0) {
            showMessage(
                calibrationMessage,
                "Tuqaawwan lamaan bakka adda addaa irratti filadhu.",
                "error"
            );
            return;
        }

        /*
         * First use:
         * Calibrate using a known reference object.
         *
         * Later use:
         * Measure the target object with the saved scale.
         */

        if (metersPerPixel === null) {
            const knownLength = Number(
                referenceLength ? referenceLength.value : 0
            );

            const unit = referenceUnit
                ? String(referenceUnit.value || "m").toLowerCase()
                : "m";

            if (!Number.isFinite(knownLength) || knownLength <= 0) {
                showMessage(
                    calibrationMessage,
                    "Dheerina reference dhugaa sirrii galchi.",
                    "error"
                );
                return;
            }

            const knownMeters = unitToMeters(knownLength, unit);

            if (!Number.isFinite(knownMeters) || knownMeters <= 0) {
                showMessage(
                    calibrationMessage,
                    "Unit filatame sirrii miti.",
                    "error"
                );
                return;
            }

            metersPerPixel = knownMeters / pixels;

            displayMeasurement(
                knownMeters,
                "Kun dheerina reference ati galchite dha; amma wanta biraa safaruu dandeessa."
            );

            showMessage(
                calibrationMessage,
                "Calibration milkaa'eera. Amma wanta safaruu barbaaddu irratti tuqaawwan lama filadhu.",
                "success"
            );

            photoPoints = [];

            drawPhotoCanvas();
            updatePointInformation();

            showMessage(
                measurementInstructions,
                "Calibration xumurameera. Amma wanta safaruu barbaaddu irratti tuqaa jalqabaa fi dhumaa filadhu; achiis button Calibrate/Measure tuqi.",
                "success"
            );

            setStatus("Calibration xumurameera", "active");

            return;
        }

        // Measurement after calibration.
        const measuredMeters = pixels * metersPerPixel;

        if (!Number.isFinite(measuredMeters) || measuredMeters <= 0) {
            showMessage(
                calibrationMessage,
                "Safartuu argame sirrii miti. Irra deebi'i.",
                "error"
            );
            return;
        }

        displayMeasurement(
            measuredMeters,
            "Tilmaama kalibreessii irratti hundaa'e. Sirrummaan fageenya, perspective fi reference irratti hundaa'a."
        );

        showMessage(
            calibrationMessage,
            "Safartuun xumurameera. Wantoota biroo safaruuf tuqaawwan lama haaraa filadhu.",
            "success"
        );

        setStatus("Safartuun xumurameera", "active");
    }

    /* =====================================================
       HEIGHT CALCULATOR
       Formula:
       height = observerHeight + distance * tan(angle)
       ===================================================== */

    function calculateHeight() {
        const distance = Number(
            horizontalDistance ? horizontalDistance.value : NaN
        );

        const angleDegrees = Number(
            viewingAngle ? viewingAngle.value : NaN
        );

        const eyeHeight = Number(
            observerHeight ? observerHeight.value : NaN
        );

        if (
            !Number.isFinite(distance) ||
            !Number.isFinite(angleDegrees) ||
            !Number.isFinite(eyeHeight)
        ) {
            showMessage(
                heightCalculatorMessage,
                "Lakkoofsa sirrii hunda galchi.",
                "error"
            );
            return;
        }

        if (distance <= 0) {
            showMessage(
                heightCalculatorMessage,
                "Fageenyi nama irraa gara wantaatti 0 ol ta'uu qaba.",
                "error"
            );
            return;
        }

        if (angleDegrees < 0 || angleDegrees >= 89.9) {
            showMessage(
                heightCalculatorMessage,
                "Angle 0° hanga 89.9° gidduu galchi.",
                "error"
            );
            return;
        }

        if (eyeHeight < 0) {
            showMessage(
                heightCalculatorMessage,
                "Olka'iinsi camera ykn ijaa 0 gadi ta'uu hin qabu.",
                "error"
            );
            return;
        }

        const radians = angleDegrees * Math.PI / 180;

        const verticalDifference =
            distance * Math.tan(radians);

        const totalHeight =
            eyeHeight + verticalDifference;

        if (!Number.isFinite(totalHeight) || totalHeight < 0) {
            showMessage(
                heightCalculatorMessage,
                "Bu'aan herregaa sirrii miti.",
                "error"
            );
            return;
        }

        setText(
            calculatedHeight,
            formatNumber(totalHeight, 3) + " m"
        );

        if (heightCalculatorResult) {
            heightCalculatorResult.style.display = "block";
        }

        showMessage(
            heightCalculatorMessage,
            "Tilmaamni xumurameera. Angle fi fageenya sirrii galchuun bu'aa fooyyessa.",
            "success"
        );
    }

    /* =====================================================
       UNIT CONVERTER
       ===================================================== */

    function convertUnits() {
        if (!convertValue || !convertFrom ||
            !convertTo || !conversionResult) {
            return;
        }

        const value = Number(convertValue.value);

        const from = String(convertFrom.value || "m")
            .toLowerCase();

        const to = String(convertTo.value || "cm")
            .toLowerCase();

        if (!Number.isFinite(value)) {
            conversionResult.textContent =
                "Maaloo lakkoofsa sirrii galchi.";
            return;
        }

        if (!UNIT_TO_METERS[from] || !UNIT_TO_METERS[to]) {
            conversionResult.textContent =
                "Unit filatame hin beekamne.";
            return;
        }

        const meters = unitToMeters(value, from);
        const converted = metersToUnit(meters, to);

        conversionResult.textContent =
            formatNumber(value, 6) +
            " " + UNIT_LABELS[from] +
            " = " +
            formatNumber(converted, 6) +
            " " + UNIT_LABELS[to];
    }

    function swapConverterUnits() {
        if (!convertFrom || !convertTo) return;

        const oldFrom = convertFrom.value;

        convertFrom.value = convertTo.value;
        convertTo.value = oldFrom;

        convertUnits();
    }

    /* =====================================================
       TOOL CARD SELECTION
       ===================================================== */

    const TOOL_CONTENT = {
        human: {
            title: "Human Height",
            description:
                "Dheerina namaa suuraa kalibreessame ykn angle fi fageenya fayyadamuun tilmaami.",
            instructions:
                "Dheerina namaa suuraa irratti safaruuf reference beekamaa barbaachisa. Yookaan distance fi angle calculator fayyadami."
        },

        tree: {
            title: "Tree Height",
            description:
                "Olka'iinsa muka angle fi fageenya irraa tilmaami.",
            instructions:
                "Fageenya muka irraa fi angle gara fiixee mukaatti ilaaltu galchi. Bu'aan tilmaama."
        },

        building: {
            title: "Building Height",
            description:
                "Olka'iinsa gamoo fageenya fi angle fayyadamuun tilmaami.",
            instructions:
                "Fageenya gamoo irraa fi angle sirrii galchi. Safartuun angle fi fageenya irratti hundaa'a."
        },

        object: {
            title: "Object Length",
            description:
                "Dheerina wantaa suuraa irratti reference beekamaa fayyadamuun safari.",
            instructions:
                "Suuraa upload godhi. Reference beekamaa irratti tuqaawwan lama filadhu, dheerina isaa galchiitii calibration xumuri."
        },

        distance: {
            title: "Distance Meter",
            description:
                "Fageenya fi angle irraa garaagarummaa olka'iinsaa herregi.",
            instructions:
                "Distance, viewing angle fi camera height galchi. Kun tilmaama trigonometrikii dha; GPS ykn laser distance miti."
        },

        photo: {
            title: "Photo Measurement",
            description:
                "Suuraa upload godhi, reference kalibreessi, dheerina wantaa safari.",
            instructions:
                "Suuraa upload godhi. Reference beekamaa kalibreessi; sana booda wanta safaruu barbaaddu irratti tuqaawwan lama filadhu."
        }
    };

    function selectTool(tool) {
        if (!TOOL_CONTENT[tool]) return;

        currentTool = tool;

        const content = TOOL_CONTENT[tool];

        setText(studioTitle, content.title);
        setText(studioDescription, content.description);

        showMessage(
            measurementInstructions,
            content.instructions,
            ""
        );

        if (tool === "distance" ||
            tool === "human" ||
            tool === "tree" ||
            tool === "building") {

            const calculator = horizontalDistance
                ? horizontalDistance.closest("section, .calculator-card, .tool-panel")
                : null;

            if (calculator) {
                calculator.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            } else {
                scrollToStudio();
            }
        } else {
            scrollToStudio();
        }
    }

    /* =====================================================
       EVENT LISTENERS
       ===================================================== */

    if (startCameraBtn) {
        startCameraBtn.addEventListener("click", startCamera);
    }

    if (cameraPlaceholderBtn) {
        cameraPlaceholderBtn.addEventListener("click", startCamera);
    }

    if (stopCameraBtn) {
        stopCameraBtn.addEventListener("click", () => {
            stopCamera();

            setStatus("Camera cufameera", "ready");

            showMessage(
                measurementInstructions,
                photoReady
                    ? "Camera cufameera. Suuraa irratti safaruu itti fufuu dandeessa."
                    : "Camera cufameera. Camera irra deebi'ii banuu ykn suuraa upload gochuu dandeessa.",
                ""
            );
        });
    }

    if (uploadTriggerBtn) {
        uploadTriggerBtn.addEventListener("click", openPhotoPicker);
    }

    if (changePhotoBtn) {
        changePhotoBtn.addEventListener("click", openPhotoPicker);
    }

    if (photoInput) {
        photoInput.addEventListener("change", handlePhotoUpload);
    }

    if (measurementCanvas) {
        measurementCanvas.addEventListener(
            "pointerdown",
            handleCanvasClick
        );
    }

    if (clearPointsBtn) {
        clearPointsBtn.addEventListener(
            "click",
            clearPhotoPoints
        );
    }

    if (calibrateBtn) {
        calibrateBtn.addEventListener(
            "click",
            handleCalibrationOrMeasurement
        );
    }

    if (calculateHeightBtn) {
        calculateHeightBtn.addEventListener(
            "click",
            calculateHeight
        );
    }

    if (convertValue) {
        convertValue.addEventListener("input", convertUnits);
    }

    if (convertFrom) {
        convertFrom.addEventListener("change", convertUnits);
    }

    if (convertTo) {
        convertTo.addEventListener("change", convertUnits);
    }

    if (swapUnitsBtn) {
        swapUnitsBtn.addEventListener(
            "click",
            swapConverterUnits
        );
    }

    if (resultUnit) {
        resultUnit.addEventListener(
            "change",
            refreshDisplayedMeasurement
        );
    }

    /* =====================================================
       TOOL CARDS
       ===================================================== */

    document.querySelectorAll("[data-tool]").forEach((card) => {
        card.addEventListener("click", () => {
            const tool = card.getAttribute("data-tool");

            selectTool(tool);
        });
    });

    /* =====================================================
       KEYBOARD ACCESSIBILITY
       ===================================================== */

    document.querySelectorAll("[data-tool]").forEach((card) => {
        if (!card.hasAttribute("tabindex")) {
            card.setAttribute("tabindex", "0");
        }

        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();

                selectTool(
                    card.getAttribute("data-tool")
                );
            }
        });
    });

    /* =====================================================
       WINDOW RESIZE
       ===================================================== */

    window.addEventListener("resize", () => {
        if (photoReady && currentMode === "photo") {
            drawPhotoCanvas();
        }
    });

    /* =====================================================
       PAGE INITIALIZATION
       ===================================================== */

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    showPlaceholder();

    setStatus("System ready", "ready");

    setText(resultValue, "—");
    setText(startPointResult, "—");
    setText(endPointResult, "—");
    setText(pixelDistanceResult, "—");

    if (heightCalculatorResult) {
        heightCalculatorResult.style.display = "block";
    }

    if (convertValue && convertFrom && convertTo) {
        convertUnits();
    }

    showMessage(
        measurementInstructions,
        "Jalqabuuf camera bani ykn suuraa upload godhi. Safartuu suuraa sirrii argachuuf reference dheerinni isaa beekamu barbaachisa.",
        ""
    );

    console.log("NAOL 3D SMART RULER initialized successfully.");
});
