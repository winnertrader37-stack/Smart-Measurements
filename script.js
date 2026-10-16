"use strict";

/* =========================================================
   NAOL 3D SMART RULER
   Complete JavaScript
   Camera Fix + Photo Measurement + Calibration
   Height Calculator + Unit Converter
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       1. HTML ELEMENTS
       ===================================================== */

    const $ = (id) => document.getElementById(id);

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


    /* =====================================================
       2. APPLICATION STATE
       ===================================================== */

    let cameraStream = null;

    let currentMode = "empty";
    let currentTool = "photo";

    let photoReady = false;
    let photoPoints = [];

    let metersPerPixel = null;
    let lastMeasuredMeters = null;

    let currentObjectUrl = null;

    let cameraStarting = false;


    /* =====================================================
       3. UNIT CONVERSION
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
       4. GENERAL HELPERS
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


    function setText(element, value) {
        if (element) {
            element.textContent = String(value);
        }
    }


    function formatNumber(value, decimals = 3) {
        if (!Number.isFinite(value)) {
            return "—";
        }

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


    function unitToMeters(value, unit) {
        const factor = UNIT_TO_METERS[unit];

        if (!factor || !Number.isFinite(value)) {
            return NaN;
        }

        return value * factor;
    }


    function metersToUnit(value, unit) {
        const factor = UNIT_TO_METERS[unit];

        if (!factor || !Number.isFinite(value)) {
            return NaN;
        }

        return value / factor;
    }


    function getSelectedResultUnit() {
        if (!resultUnit) {
            return "m";
        }

        const unit = String(resultUnit.value || "m")
            .toLowerCase()
            .trim();

        return UNIT_TO_METERS[unit] ? unit : "m";
    }


    /* =====================================================
       5. RESULT DISPLAY
       ===================================================== */

    function displayMeasurement(meters, explanation) {
        if (!Number.isFinite(meters) || meters < 0) {
            setText(resultValue, "—");

            setText(
                resultExplanation,
                "Safartuun sirrii hin taane."
            );

            return;
        }

        lastMeasuredMeters = meters;

        const unit = getSelectedResultUnit();

        const converted = metersToUnit(meters, unit);

        setText(
            resultValue,
            formatNumber(converted, 4)
        );

        setText(
            resultExplanation,
            explanation
        );
    }


    function refreshDisplayedMeasurement() {
        if (lastMeasuredMeters === null) {
            return;
        }

        const explanation = resultExplanation
            ? resultExplanation.textContent
            : "Safartuu xumurame.";

        displayMeasurement(
            lastMeasuredMeters,
            explanation
        );
    }


    /* =====================================================
       6. VIDEO AND CAMERA DISPLAY
       ===================================================== */

    function hideAllCameraViews() {
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
    }


    function showPlaceholder() {
        hideAllCameraViews();

        if (cameraPlaceholder) {
            cameraPlaceholder.style.display = "flex";
        }

        if (stopCameraBtn) {
            stopCameraBtn.style.display = "none";
        }
    }


    function showPhotoCanvas() {
        if (!photoReady ||
            !measurementCanvas ||
            !cameraFrame) {

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


    /* =====================================================
       7. STOP CAMERA
       ===================================================== */

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach((track) => {
                try {
                    track.stop();
                } catch (error) {
                    console.warn(
                        "Camera track stop warning:",
                        error
                    );
                }
            });

            cameraStream = null;
        }

        if (cameraVideo) {
            try {
                cameraVideo.pause();
            } catch (error) {
                // Ignore pause errors.
            }

            cameraVideo.srcObject = null;
            cameraVideo.style.display = "none";
        }

        if (cameraOverlay) {
            cameraOverlay.style.display = "none";
        }

        if (stopCameraBtn) {
            stopCameraBtn.style.display = "none";
        }

        if (photoReady) {
            currentMode = "photo";
            showPhotoCanvas();
        } else {
            currentMode = "empty";
            showPlaceholder();
        }
    }


    /* =====================================================
       8. START CAMERA — FIXED VERSION
       ===================================================== */

    async function startCamera() {

        if (cameraStarting) {
            return;
        }

        if (!cameraVideo) {
            setStatus(
                "Camera video element hin argamne.",
                "error"
            );

            alert(
                "Camera element hin argamne. index.html keessatti cameraVideo ilaali."
            );

            return;
        }

        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {

            setStatus(
                "Browser camera hin deeggaru.",
                "error"
            );

            showMessage(
                measurementInstructions,
                "Camera fayyadamuuf website HTTPS irratti banuu fi browser camera deeggaru fayyadamuu qabda.",
                "error"
            );

            alert(
                "Camera browser kana irratti hin deeggaramu. Chrome keessatti website HTTPS irratti bani."
            );

            return;
        }

        cameraStarting = true;

        setStatus(
            "Camera banamaa jira...",
            "warning"
        );

        showMessage(
            measurementInstructions,
            "Maaloo camera banuu hanga xumuramutti eegi.",
            ""
        );

        try {

            /*
             * Stop old camera tracks before requesting
             * a new stream.
             */

            if (cameraStream) {
                cameraStream.getTracks().forEach((track) => {
                    track.stop();
                });

                cameraStream = null;
            }

            cameraVideo.pause();
            cameraVideo.srcObject = null;

            /*
             * Hide photo view before displaying live video.
             */

            hideAllCameraViews();

            if (cameraPlaceholder) {
                cameraPlaceholder.style.display = "none";
            }

            /*
             * First try the rear camera.
             */

            let stream;

            try {

                stream =
                    await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: {
                                ideal: "environment"
                            },
                            width: {
                                ideal: 1280
                            },
                            height: {
                                ideal: 720
                            }
                        },
                        audio: false
                    });

            } catch (rearCameraError) {

                console.warn(
                    "Rear camera failed. Trying default camera.",
                    rearCameraError
                );

                /*
                 * Fallback: request any available camera.
                 */

                stream =
                    await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: false
                    });
            }

            cameraStream = stream;

            /*
             * Configure the video element.
             */

            cameraVideo.autoplay = true;
            cameraVideo.playsInline = true;
            cameraVideo.muted = true;

            cameraVideo.setAttribute("autoplay", "");
            cameraVideo.setAttribute("playsinline", "");
            cameraVideo.setAttribute("muted", "");

            cameraVideo.style.display = "block";
            cameraVideo.style.visibility = "visible";
            cameraVideo.style.opacity = "1";

            cameraVideo.style.width = "100%";
            cameraVideo.style.height = "100%";

            cameraVideo.style.objectFit = "contain";
            cameraVideo.style.background = "#101827";

            cameraVideo.style.position = "relative";
            cameraVideo.style.zIndex = "5";

            cameraVideo.srcObject = stream;

            /*
             * Wait for the camera to produce actual video
             * dimensions. This helps prevent a blank screen.
             */

            await new Promise((resolve, reject) => {

                let completed = false;

                const timeout = setTimeout(() => {
                    finish(
                        new Error(
                            "Camera video hin jalqabne."
                        )
                    );
                }, 12000);


                function cleanup() {
                    clearTimeout(timeout);

                    cameraVideo.removeEventListener(
                        "loadedmetadata",
                        checkReady
                    );

                    cameraVideo.removeEventListener(
                        "canplay",
                        checkReady
                    );

                    cameraVideo.removeEventListener(
                        "playing",
                        checkReady
                    );
                }


                function finish(error = null) {
                    if (completed) return;

                    completed = true;

                    cleanup();

                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                }


                function checkReady() {
                    if (
                        cameraVideo.videoWidth > 0 &&
                        cameraVideo.videoHeight > 0
                    ) {
                        finish();
                    }
                }


                cameraVideo.addEventListener(
                    "loadedmetadata",
                    checkReady
                );

                cameraVideo.addEventListener(
                    "canplay",
                    checkReady
                );

                cameraVideo.addEventListener(
                    "playing",
                    checkReady
                );

                /*
                 * Metadata may already be available.
                 */

                checkReady();

            });


            /*
             * Start playback.
             */

            await cameraVideo.play();


            /*
             * Show the camera controls and overlay.
             */

            if (cameraPlaceholder) {
                cameraPlaceholder.style.display = "none";
            }

            if (cameraOverlay) {
                cameraOverlay.style.display = "block";
                cameraOverlay.style.zIndex = "6";
            }

            if (stopCameraBtn) {
                stopCameraBtn.style.display = "inline-flex";
            }

            currentMode = "camera";

            setStatus(
                "Camera hojii irra jira",
                "active"
            );

            setText(
                studioTitle,
                "Live Camera"
            );

            setText(
                studioDescription,
                "Live camera banameera. Safartuu suuraa sirrii argachuuf reference beekamaa fayyadami."
            );

            showMessage(
                measurementInstructions,
                "Camera banameera. Kun live view dha; dheerina dhugaa ofumaan hin safaru. Safaruuf suuraa upload godhi ykn height calculator fayyadami.",
                "success"
            );

            scrollToStudio();

        } catch (error) {

            console.error(
                "NAOL SMART RULER CAMERA ERROR:",
                error
            );

            /*
             * Stop all tracks if startup fails.
             */

            if (cameraStream) {
                cameraStream.getTracks().forEach((track) => {
                    try {
                        track.stop();
                    } catch (stopError) {
                        console.warn(stopError);
                    }
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

            if (photoReady) {
                showPhotoCanvas();
            } else {
                showPlaceholder();
            }

            setStatus(
                "Camera hin banamne.",
                "error"
            );

            let errorMessage =
                "Camera hin banamne. Browser refresh godhiitii irra deebi'i.";

            if (
                error &&
                error.name === "NotAllowedError"
            ) {

                errorMessage =
                    "Camera permission dhoorkameera. Browser settings keessatti camera eeyyami.";

            } else if (
                error &&
                error.name === "NotFoundError"
            ) {

                errorMessage =
                    "Camera bilbila kee irratti hin argamne.";

            } else if (
                error &&
                error.name === "NotReadableError"
            ) {

                errorMessage =
                    "Camera app biraan fayyadamaa jira. App sana cufiitii irra deebi'i.";

            } else if (
                error &&
                error.name === "SecurityError"
            ) {

                errorMessage =
                    "Camera fayyadamuuf website HTTPS irratti banamuu qaba.";

            } else if (
                error &&
                error.name === "OverconstrainedError"
            ) {

                errorMessage =
                    "Camera setting filatame hin deeggaramu. Camera biraa yaali.";

            } else if (
                error &&
                error.name === "AbortError"
            ) {

                errorMessage =
                    "Camera jalqabuu addaan cite. Irra deebi'i.";

            } else if (
                error &&
                error.name === "NotSupportedError"
            ) {

                errorMessage =
                    "Browser video kana hin deeggaru. Chrome browser yaali.";
            }

            showMessage(
                measurementInstructions,
                errorMessage,
                "error"
            );

            alert(errorMessage);

        } finally {

            cameraStarting = false;
        }
    }


    /* =====================================================
       9. PHOTO CANVAS
       ===================================================== */

    function drawPhotoCanvas() {

        if (
            !photoReady ||
            !measurementCanvas ||
            !uploadedImage ||
            !uploadedImage.naturalWidth ||
            !uploadedImage.naturalHeight
        ) {
            return;
        }

        const canvas = measurementCanvas;
        const context = canvas.getContext("2d");

        if (!context) return;

        const imageWidth = uploadedImage.naturalWidth;
        const imageHeight = uploadedImage.naturalHeight;

        /*
         * Keep the canvas resolution equal to the original
         * photo dimensions to preserve point coordinates.
         */

        if (canvas.width !== imageWidth) {
            canvas.width = imageWidth;
        }

        if (canvas.height !== imageHeight) {
            canvas.height = imageHeight;
        }

        if (cameraFrame) {
            cameraFrame.style.aspectRatio =
                imageWidth + " / " + imageHeight;

            cameraFrame.style.minHeight = "0";
            cameraFrame.style.height = "auto";
        }

        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        context.drawImage(
            uploadedImage,
            0,
            0,
            imageWidth,
            imageHeight
        );

        /*
         * Draw the line connecting the selected points.
         */

        if (photoPoints.length >= 2) {

            const first = photoPoints[0];
            const second = photoPoints[1];

            context.save();

            context.beginPath();

            context.moveTo(
                first.x,
                first.y
            );

            context.lineTo(
                second.x,
                second.y
            );

            context.lineWidth = Math.max(
                3,
                imageWidth / 500
            );

            context.strokeStyle = "#00e5ff";

            context.stroke();

            context.restore();
        }

        /*
         * Draw point markers.
         */

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
                index === 0
                    ? "#00e5ff"
                    : "#ffb84d";

            context.fill();

            context.lineWidth = Math.max(
                2,
                imageWidth / 800
            );

            context.strokeStyle = "#ffffff";

            context.stroke();

            context.font =
                "bold " +
                Math.max(18, imageWidth / 35) +
                "px Arial";

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
       10. PHOTO UPLOAD
       ===================================================== */

    function openPhotoPicker() {
        if (photoInput) {
            photoInput.click();
        }
    }


    function handlePhotoUpload(event) {

        const file =
            event.target.files &&
            event.target.files[0];

        if (!file) return;

        if (
            !file.type ||
            !file.type.startsWith("image/")
        ) {

            setStatus(
                "Faayiliin filatame suuraa miti.",
                "error"
            );

            showMessage(
                measurementInstructions,
                "JPG, PNG, WEBP ykn suuraa biraa filadhu.",
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

            setStatus(
                "Image element hin argamne.",
                "error"
            );

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

            setText(
                studioTitle,
                "Photo Measurement"
            );

            setText(
                studioDescription,
                "Suuraa irratti tuqaawwan lama filadhu. Reference beekamaa fayyadamuun wantoota biroo safari."
            );

            setText(resultValue, "—");
            setText(startPointResult, "—");
            setText(endPointResult, "—");
            setText(pixelDistanceResult, "—");

            showPhotoCanvas();

            setStatus(
                "Suuraan fe'ameera",
                "active"
            );

            showMessage(
                measurementInstructions,
                "Jalqaba wanta dheerinni isaa beekamu filadhu. Tuqaa A fi B irratti tuqi; dheerina dhugaa galchiitii Calibrate tuqi.",
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

            setStatus(
                "Suuraa banuun hin danda'amne.",
                "error"
            );

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
       11. PHOTO POINT SELECTION
       ===================================================== */

    function getCanvasPoint(event) {

        if (!measurementCanvas) {
            return null;
        }

        const rect =
            measurementCanvas.getBoundingClientRect();

        if (!rect.width || !rect.height) {
            return null;
        }

        const scaleX =
            measurementCanvas.width / rect.width;

        const scaleY =
            measurementCanvas.height / rect.height;

        const x =
            (event.clientX - rect.left) * scaleX;

        const y =
            (event.clientY - rect.top) * scaleY;

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

        return Math.sqrt(
            dx * dx + dy * dy
        );
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

            setText(
                startPointResult,
                "—"
            );
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

            setText(
                endPointResult,
                "—"
            );

            setText(
                pixelDistanceResult,
                "—"
            );
        }
    }


    function handleCanvasClick(event) {

        if (
            !photoReady ||
            currentMode !== "photo"
        ) {
            return;
        }

        const point = getCanvasPoint(event);

        if (!point) return;

        /*
         * After two points have been selected,
         * the next click starts a new pair.
         */

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
                "Tuqaawwan A fi B filatamaniiru. Calibration ykn measurement itti fufi.",
                "success"
            );
        }
    }


    function clearPhotoPoints() {

        photoPoints = [];

        drawPhotoCanvas();

        updatePointInformation();

        setText(
            pixelDistanceResult,
            "—"
        );

        showMessage(
            measurementInstructions,

            metersPerPixel !== null
                ? "Calibration jira. Amma wanta safaruu barbaaddu irratti tuqaawwan lama filadhu."
                : "Tuqaawwan lama suuraa irratti filadhu.",

            ""
        );
    }


    /* =====================================================
       12. CALIBRATION AND MEASUREMENT
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
                "Suuraa irratti tuqaawwan lama filadhu.",
                "error"
            );

            return;
        }

        const pixels = calculatePixelDistance(
            photoPoints[0],
            photoPoints[1]
        );

        if (
            !Number.isFinite(pixels) ||
            pixels <= 0
        ) {

            showMessage(
                calibrationMessage,
                "Tuqaawwan lamaan bakka adda addaa irratti filadhu.",
                "error"
            );

            return;
        }

        /*
         * FIRST STAGE:
         * Calibrate with an object whose real length is known.
         */

        if (metersPerPixel === null) {

            const knownLength = Number(
                referenceLength
                    ? referenceLength.value
                    : 0
            );

            const unit = referenceUnit
                ? String(referenceUnit.value || "m").toLowerCase()
                : "m";

            if (
                !Number.isFinite(knownLength) ||
                knownLength <= 0
            ) {

                showMessage(
                    calibrationMessage,
                    "Dheerina reference dhugaa sirrii galchi.",
                    "error"
                );

                return;
            }

            const knownMeters = unitToMeters(
                knownLength,
                unit
            );

            if (
                !Number.isFinite(knownMeters) ||
                knownMeters <= 0
            ) {

                showMessage(
                    calibrationMessage,
                    "Unit filatame sirrii miti.",
                    "error"
                );

                return;
            }

            metersPerPixel =
                knownMeters / pixels;

            displayMeasurement(
                knownMeters,
                "Dheerina reference ati galchite. Amma wanta biraa safaruu dandeessa."
            );

            showMessage(
                calibrationMessage,
                "Calibration milkaa'eera. Amma wanta safaruu barbaaddu irratti tuqaawwan lama haaraa filadhu.",
                "success"
            );

            photoPoints = [];

            drawPhotoCanvas();

            updatePointInformation();

            showMessage(
                measurementInstructions,
                "Calibration xumurameera. Amma wanta safaruu barbaaddu irratti tuqaa jalqabaa fi dhumaa filadhu; sana booda button Calibrate tuqi.",
                "success"
            );

            setStatus(
                "Calibration xumurameera",
                "active"
            );

            return;
        }

        /*
         * SECOND STAGE:
         * Measure another object using the calibrated scale.
         */

        const measuredMeters =
            pixels * metersPerPixel;

        if (
            !Number.isFinite(measuredMeters) ||
            measuredMeters <= 0
        ) {

            showMessage(
                calibrationMessage,
                "Safartuu argame sirrii miti. Irra deebi'i.",
                "error"
            );

            return;
        }

        displayMeasurement(
            measuredMeters,
            "Tilmaama calibration irratti hundaa'e. Sirrummaan fageenya fi perspective irratti hundaa'a."
        );

        showMessage(
            calibrationMessage,
            "Safartuun xumurameera. Wantoota biroo safaruuf tuqaawwan lama haaraa filadhu.",
            "success"
        );

        setStatus(
            "Safartuun xumurameera",
            "active"
        );
    }


    /* =====================================================
       13. HEIGHT CALCULATOR
       ===================================================== */

    function calculateHeight() {

        const distance = Number(
            horizontalDistance
                ? horizontalDistance.value
                : NaN
        );

        const angleDegrees = Number(
            viewingAngle
                ? viewingAngle.value
                : NaN
        );

        const eyeHeight = Number(
            observerHeight
                ? observerHeight.value
                : NaN
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
                "Fageenyi 0 ol ta'uu qaba.",
                "error"
            );

            return;
        }

        if (
            angleDegrees < 0 ||
            angleDegrees >= 89.9
        ) {

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
                "Olka'iinsi camera 0 gadi ta'uu hin qabu.",
                "error"
            );

            return;
        }

        const radians =
            angleDegrees * Math.PI / 180;

        const verticalDifference =
            distance * Math.tan(radians);

        const totalHeight =
            eyeHeight + verticalDifference;

        if (
            !Number.isFinite(totalHeight) ||
            totalHeight < 0
        ) {

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
            "Tilmaamni xumurameera. Bu'aan distance fi angle sirrii galchuu irratti hundaa'a.",
            "success"
        );
    }


    /* =====================================================
       14. UNIT CONVERTER
       ===================================================== */

    function convertUnits() {

        if (
            !convertValue ||
            !convertFrom ||
            !convertTo ||
            !conversionResult
        ) {
            return;
        }

        const value = Number(convertValue.value);

        const from = String(
            convertFrom.value || "m"
        ).toLowerCase();

        const to = String(
            convertTo.value || "cm"
        ).toLowerCase();

        if (!Number.isFinite(value)) {

            conversionResult.textContent =
                "Lakkoofsa sirrii galchi.";

            return;
        }

        if (
            !UNIT_TO_METERS[from] ||
            !UNIT_TO_METERS[to]
        ) {

            conversionResult.textContent =
                "Unit filatame hin beekamne.";

            return;
        }

        const meters = unitToMeters(
            value,
            from
        );

        const converted = metersToUnit(
            meters,
            to
        );

        conversionResult.textContent =
            formatNumber(value, 6) +
            " " + UNIT_LABELS[from] +
            " = " +
            formatNumber(converted, 6) +
            " " + UNIT_LABELS[to];
    }


    function swapConverterUnits() {

        if (!convertFrom || !convertTo) {
            return;
        }

        const oldFrom = convertFrom.value;

        convertFrom.value = convertTo.value;
        convertTo.value = oldFrom;

        convertUnits();
    }


    /* =====================================================
       15. TOOL CARD CONTENT
       ===================================================== */

    const TOOL_CONTENT = {

        human: {
            title: "Human Height",
            description:
                "Dheerina namaa reference calibration ykn angle fi fageenya fayyadamuun tilmaami.",
            instructions:
                "Dheerina namaa suuraa irratti safaruuf reference beekamaa barbaachisa. Yookaan distance fi angle calculator fayyadami."
        },

        tree: {
            title: "Tree Height",
            description:
                "Olka'iinsa muka angle fi fageenya irraa tilmaami.",
            instructions:
                "Fageenya muka irraa fi angle gara fiixee mukaatti ilaaltu galchi."
        },

        building: {
            title: "Building Height",
            description:
                "Olka'iinsa gamoo fageenya fi angle fayyadamuun tilmaami.",
            instructions:
                "Fageenya gamoo irraa fi angle sirrii galchi."
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
                "Distance, viewing angle fi camera height galchi. Kun tilmaama herregaa dha; GPS ykn laser distance miti."
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

        if (!TOOL_CONTENT[tool]) {
            return;
        }

        currentTool = tool;

        const content = TOOL_CONTENT[tool];

        setText(
            studioTitle,
            content.title
        );

        setText(
            studioDescription,
            content.description
        );

        showMessage(
            measurementInstructions,
            content.instructions,
            ""
        );

        if (
            tool === "distance" ||
            tool === "human" ||
            tool === "tree" ||
            tool === "building"
        ) {

            const calculator =
                horizontalDistance
                    ? horizontalDistance.closest(
                        "section, .calculator-card, .tool-panel"
                    )
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
       16. CAMERA BUTTON EVENTS
       ===================================================== */

    if (startCameraBtn) {
        startCameraBtn.addEventListener(
            "click",
            startCamera
        );
    }

    if (cameraPlaceholderBtn) {
        cameraPlaceholderBtn.addEventListener(
            "click",
            startCamera
        );
    }


    /* =====================================================
       17. STOP CAMERA BUTTON
       ===================================================== */

    if (stopCameraBtn) {

        stopCameraBtn.addEventListener(
            "click",
            () => {

                stopCamera();

                setStatus(
                    "Camera cufameera",
                    "ready"
                );

                showMessage(
                    measurementInstructions,

                    photoReady
                        ? "Camera cufameera. Suuraa irratti safaruu itti fufuu dandeessa."
                        : "Camera cufameera. Irra deebi'ii banuu ykn suuraa upload gochuu dandeessa.",

                    ""
                );
            }
        );
    }


    /* =====================================================
       18. PHOTO BUTTON EVENTS
       ===================================================== */

    if (uploadTriggerBtn) {
        uploadTriggerBtn.addEventListener(
            "click",
            openPhotoPicker
        );
    }

    if (changePhotoBtn) {
        changePhotoBtn.addEventListener(
            "click",
            openPhotoPicker
        );
    }

    if (photoInput) {
        photoInput.addEventListener(
            "change",
            handlePhotoUpload
        );
    }


    /* =====================================================
       19. PHOTO CANVAS EVENTS
       ===================================================== */

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


    /* =====================================================
       20. HEIGHT CALCULATOR EVENTS
       ===================================================== */

    if (calculateHeightBtn) {

        calculateHeightBtn.addEventListener(
            "click",
            calculateHeight
        );
    }


    /* =====================================================
       21. UNIT CONVERTER EVENTS
       ===================================================== */

    if (convertValue) {

        convertValue.addEventListener(
            "input",
            convertUnits
        );
    }

    if (convertFrom) {

        convertFrom.addEventListener(
            "change",
            convertUnits
        );
    }

    if (convertTo) {

        convertTo.addEventListener(
            "change",
            convertUnits
        );
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
       22. TOOL CARD EVENTS
       ===================================================== */

    document.querySelectorAll("[data-tool]").forEach(
        (card) => {

            card.addEventListener(
                "click",
                () => {

                    const tool =
                        card.getAttribute("data-tool");

                    selectTool(tool);
                }
            );

            if (!card.hasAttribute("tabindex")) {
                card.setAttribute("tabindex", "0");
            }

            card.addEventListener(
                "keydown",
                (event) => {

                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {

                        event.preventDefault();

                        selectTool(
                            card.getAttribute("data-tool")
                        );
                    }
                }
            );
        }
    );


    /* =====================================================
       23. RESIZE HANDLER
       ===================================================== */

    window.addEventListener(
        "resize",
        () => {

            if (
                photoReady &&
                currentMode === "photo"
            ) {

                drawPhotoCanvas();
            }
        }
    );


    /* =====================================================
       24. CLEAN UP CAMERA WHEN LEAVING
       ===================================================== */

    window.addEventListener(
        "pagehide",
        () => {

            if (cameraStream) {

                cameraStream.getTracks().forEach(
                    (track) => {
                        track.stop();
                    }
                );

                cameraStream = null;
            }
        }
    );


    /* =====================================================
       25. INITIALIZE WEBSITE
       ===================================================== */

    showPlaceholder();

    setStatus(
        "System ready",
        "ready"
    );

    setText(resultValue, "—");
    setText(startPointResult, "—");
    setText(endPointResult, "—");
    setText(pixelDistanceResult, "—");

    if (heightCalculatorResult) {
        heightCalculatorResult.style.display = "block";
    }

    if (
        convertValue &&
        convertFrom &&
        convertTo
    ) {

        convertUnits();
    }

    showMessage(
        measurementInstructions,
        "Jalqabuuf camera bani ykn suuraa upload godhi. Camera browser keessatti eeyyamamuu qaba.",
        ""
    );

    console.log(
        "NAOL 3D SMART RULER initialized successfully."
    );

});
