var Module = typeof Module != "undefined" ? Module : {}; //extracted from Poki's website by GoldenYoshi924
var ENVIRONMENT_IS_WEB = typeof window == "object";
var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";
var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && process.type != "renderer";
if (ENVIRONMENT_IS_NODE) {}
if (!Module["expectedDataFileDownloads"]) {
    Module["expectedDataFileDownloads"] = 0
}
Module["expectedDataFileDownloads"]++;
(()=>{
    var isPthread = typeof ENVIRONMENT_IS_PTHREAD != "undefined" && ENVIRONMENT_IS_PTHREAD;
    var isWasmWorker = typeof ENVIRONMENT_IS_WASM_WORKER != "undefined" && ENVIRONMENT_IS_WASM_WORKER;
    if (isPthread || isWasmWorker)
        return;
    function loadPackage(metadata) {
        var PACKAGE_PATH = "";
        if (typeof window === "object") {
            PACKAGE_PATH = window["encodeURIComponent"](window.location.pathname.toString().substring(0, window.location.pathname.toString().lastIndexOf("/")) + "/")
        } else if (typeof process === "undefined" && typeof location !== "undefined") {
            PACKAGE_PATH = encodeURIComponent(location.pathname.toString().substring(0, location.pathname.toString().lastIndexOf("/")) + "/")
        }
        var PACKAGE_NAME = "index.data";
        var REMOTE_PACKAGE_BASE = "index.data";
        if (typeof Module["locateFilePackage"] === "function" && !Module["locateFile"]) {
            Module["locateFile"] = Module["locateFilePackage"];
            err("warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)")
        }
        var REMOTE_PACKAGE_NAME = Module["locateFile"] ? Module["locateFile"](REMOTE_PACKAGE_BASE, "") : REMOTE_PACKAGE_BASE;
        var REMOTE_PACKAGE_SIZE = metadata["remote_package_size"];
        function fetchRemotePackage(packageName, packageSize, callback, errback) {
            if (typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string") {
                require("fs").readFile(packageName, (err,contents)=>{
                    if (err) {
                        errback(err)
                    } else {
                        callback(contents.buffer)
                    }
                }
                );
                return
            }
            Module["dataFileDownloads"] ??= {};
            fetch(packageName).catch(cause=>Promise.reject(new Error(`Network Error: ${packageName}`,{
                cause
            }))).then(response=>{
                if (!response.ok) {
                    return Promise.reject(new Error(`${response.status}: ${response.url}`))
                }
                if (!response.body && response.arrayBuffer) {
                    return response.arrayBuffer().then(callback)
                }
                const reader = response.body.getReader();
                const iterate = ()=>reader.read().then(handleChunk).catch(cause=>Promise.reject(new Error(`Unexpected error while handling : ${response.url} ${cause}`,{
                    cause
                })));
                const chunks = [];
                const headers = response.headers;
                const total = Number(headers.get("Content-Length") ?? packageSize);
                let loaded = 0;
                const handleChunk = ({done, value})=>{
                    if (!done) {
                        chunks.push(value);
                        loaded += value.length;
                        Module["dataFileDownloads"][packageName] = {
                            loaded,
                            total
                        };
                        let totalLoaded = 0;
                        let totalSize = 0;
                        for (const download of Object.values(Module["dataFileDownloads"])) {
                            totalLoaded += download.loaded;
                            totalSize += download.total
                        }
                        Module["setStatus"]?.(`Downloading data... (${totalLoaded}/${totalSize})`);
                        return iterate()
                    } else {
                        const packageData = new Uint8Array(chunks.map(c=>c.length).reduce((a,b)=>a + b, 0));
                        let offset = 0;
                        for (const chunk of chunks) {
                            packageData.set(chunk, offset);
                            offset += chunk.length
                        }
                        callback(packageData.buffer)
                    }
                }
                ;
                Module["setStatus"]?.("Downloading data...");
                return iterate()
            }
            )
        }
        function handleError(error) {
            console.error("package error:", error)
        }
        var fetchedCallback = null;
        var fetched = Module["getPreloadedPackage"] ? Module["getPreloadedPackage"](REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE) : null;
        if (!fetched)
            fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE, data=>{
                if (fetchedCallback) {
                    fetchedCallback(data);
                    fetchedCallback = null
                } else {
                    fetched = data
                }
            }
            , handleError);
        function runWithFS(Module) {
            function assert(check, msg) {
                if (!check)
                    throw msg + (new Error).stack
            }
            Module["FS_createPath"]("/", "assets", true, true);
            Module["FS_createPath"]("/assets", "blocks", true, true);
            Module["FS_createPath"]("/assets", "games", true, true);
            Module["FS_createPath"]("/assets", "sounds", true, true);
            Module["FS_createPath"]("/assets", "views", true, true);
            function DataRequest(start, end, audio) {
                this.start = start;
                this.end = end;
                this.audio = audio
            }
            DataRequest.prototype = {
                requests: {},
                open: function(mode, name) {
                    this.name = name;
                    this.requests[name] = this;
                    Module["addRunDependency"](`fp ${this.name}`)
                },
                send: function() {},
                onload: function() {
                    var byteArray = this.byteArray.subarray(this.start, this.end);
                    this.finish(byteArray)
                },
                finish: function(byteArray) {
                    var that = this;
                    Module["FS_createDataFile"](this.name, null, byteArray, true, true, true);
                    Module["removeRunDependency"](`fp ${that.name}`);
                    this.requests[this.name] = null
                }
            };
            var files = metadata["files"];
            for (var i = 0; i < files.length; ++i) {
                new DataRequest(files[i]["start"],files[i]["end"],files[i]["audio"] || 0).open("GET", files[i]["filename"])
            }
            function processPackageData(arrayBuffer) {
                assert(arrayBuffer, "Loading data file failed.");
                assert(arrayBuffer.constructor.name === ArrayBuffer.name, "bad input to processPackageData");
                var byteArray = new Uint8Array(arrayBuffer);
                DataRequest.prototype.byteArray = byteArray;
                var files = metadata["files"];
                for (var i = 0; i < files.length; ++i) {
                    DataRequest.prototype.requests[files[i].filename].onload()
                }
                Module["removeRunDependency"]("datafile_index.data")
            }
            Module["addRunDependency"]("datafile_index.data");
            if (!Module["preloadResults"])
                Module["preloadResults"] = {};
            Module["preloadResults"][PACKAGE_NAME] = {
                fromCache: false
            };
            if (fetched) {
                processPackageData(fetched);
                fetched = null
            } else {
                fetchedCallback = processPackageData
            }
        }
        if (Module["calledRun"]) {
            runWithFS(Module)
        } else {
            if (!Module["preRun"])
                Module["preRun"] = [];
            Module["preRun"].push(runWithFS)
        }
    }
    loadPackage({
        files: [{
            filename: "/assets/atlas.png",
            start: 0,
            end: 378151
        }, {
            filename: "/assets/blocks/ACCELEROMETER_V",
            start: 378151,
            end: 378464
        }, {
            filename: "/assets/blocks/ARCH",
            start: 378464,
            end: 378641
        }, {
            filename: "/assets/blocks/BALL",
            start: 378641,
            end: 378786
        }, {
            filename: "/assets/blocks/BOX",
            start: 378786,
            end: 379001
        }, {
            filename: "/assets/blocks/BRICKS",
            start: 379001,
            end: 379184
        }, {
            filename: "/assets/blocks/BUTTERFLY",
            start: 379184,
            end: 380481
        }, {
            filename: "/assets/blocks/BUTTON",
            start: 380481,
            end: 381004
        }, {
            filename: "/assets/blocks/BUTTON_B",
            start: 381004,
            end: 381889
        }, {
            filename: "/assets/blocks/CAMERA_ORBIT",
            start: 381889,
            end: 383277
        }, {
            filename: "/assets/blocks/COMMENT",
            start: 383277,
            end: 383391
        }, {
            filename: "/assets/blocks/CpF_LIST_ELEMENT_Cp",
            start: 383391,
            end: 383757
        }, {
            filename: "/assets/blocks/DASH_CAT",
            start: 383757,
            end: 385622
        }, {
            filename: "/assets/blocks/DINO",
            start: 385622,
            end: 390241
        }, {
            filename: "/assets/blocks/DINO_RED",
            start: 390241,
            end: 391976
        }, {
            filename: "/assets/blocks/DIRT",
            start: 391976,
            end: 392069
        }, {
            filename: "/assets/blocks/DIRT_B",
            start: 392069,
            end: 392248
        }, {
            filename: "/assets/blocks/DIRT_SLAB",
            start: 392248,
            end: 392370
        }, {
            filename: "/assets/blocks/ECVV_SET_ANG_LIMITS_E",
            start: 392370,
            end: 392827
        }, {
            filename: "/assets/blocks/ECVV_SET_ANG_MOTOR_E",
            start: 392827,
            end: 393282
        }, {
            filename: "/assets/blocks/ECVV_SET_ANG_SPRING_E",
            start: 393282,
            end: 393737
        }, {
            filename: "/assets/blocks/ECVV_SET_LIN_LIMITS_E",
            start: 393737,
            end: 394192
        }, {
            filename: "/assets/blocks/ECVV_SET_LIN_MOTOR_E",
            start: 394192,
            end: 394648
        }, {
            filename: "/assets/blocks/ECVV_SET_LIN_SPRING_E",
            start: 394648,
            end: 395098
        }, {
            filename: "/assets/blocks/EC_SET_VAR_E",
            start: 395098,
            end: 395353
        }, {
            filename: "/assets/blocks/ECpC_SET_VAR_E",
            start: 395353,
            end: 395730
        }, {
            filename: "/assets/blocks/EFFF_VOLUME_PITCH_E",
            start: 395730,
            end: 396173
        }, {
            filename: "/assets/blocks/EFF_LOOP_EFE",
            start: 396173,
            end: 396543
        }, {
            filename: "/assets/blocks/EFF_SET_SCORE_E",
            start: 396543,
            end: 396927
        }, {
            filename: "/assets/blocks/EFF_SFX_PLAY_FE",
            start: 396927,
            end: 397309
        }, {
            filename: "/assets/blocks/EF_INSPECT_E",
            start: 397309,
            end: 397658
        }, {
            filename: "/assets/blocks/EF_RANDOM_SEED_E",
            start: 397658,
            end: 398046
        }, {
            filename: "/assets/blocks/EF_SET_VAR_E",
            start: 398046,
            end: 398297
        }, {
            filename: "/assets/blocks/EF_SFX_STOP_E",
            start: 398297,
            end: 398673
        }, {
            filename: "/assets/blocks/EFpF_SET_VAR_E",
            start: 398673,
            end: 399047
        }, {
            filename: "/assets/blocks/EFpO_MENU_ITEM_E",
            start: 399047,
            end: 399419
        }, {
            filename: "/assets/blocks/EFp_DEC_VAR_E",
            start: 399419,
            end: 399685
        }, {
            filename: "/assets/blocks/EFp_INC_VAR_E",
            start: 399685,
            end: 399957
        }, {
            filename: "/assets/blocks/EOF_SET_BOUNCE_E",
            start: 399957,
            end: 400349
        }, {
            filename: "/assets/blocks/EOF_SET_FRICTION_E",
            start: 400349,
            end: 400745
        }, {
            filename: "/assets/blocks/EOF_SET_MASS_E",
            start: 400745,
            end: 401128
        }, {
            filename: "/assets/blocks/EOOV_ADD_CONSTRAINT_EC",
            start: 401128,
            end: 401579
        }, {
            filename: "/assets/blocks/EOT_SET_VISIBLE_E",
            start: 401579,
            end: 401957
        }, {
            filename: "/assets/blocks/EOVQ_SET_POS_E",
            start: 401957,
            end: 402419
        }, {
            filename: "/assets/blocks/EOVVV_ADD_FORCE_E",
            start: 402419,
            end: 402932
        }, {
            filename: "/assets/blocks/EOVV_SET_LOCKED_E",
            start: 402932,
            end: 403394
        }, {
            filename: "/assets/blocks/EOVV_SET_VEL_E",
            start: 403394,
            end: 403852
        }, {
            filename: "/assets/blocks/EO_COLLISION_EOFVE",
            start: 403852,
            end: 404373
        }, {
            filename: "/assets/blocks/EO_CREATE_EO",
            start: 404373,
            end: 404749
        }, {
            filename: "/assets/blocks/EO_DESTROY_E",
            start: 404749,
            end: 405126
        }, {
            filename: "/assets/blocks/EO_INSPECT_E",
            start: 405126,
            end: 405474
        }, {
            filename: "/assets/blocks/EO_SET_VAR_E",
            start: 405474,
            end: 405725
        }, {
            filename: "/assets/blocks/EOpO_SET_VAR_E",
            start: 405725,
            end: 406099
        }, {
            filename: "/assets/blocks/EQ_INSPECT_E",
            start: 406099,
            end: 406450
        }, {
            filename: "/assets/blocks/EQ_SET_VAR_E",
            start: 406450,
            end: 406703
        }, {
            filename: "/assets/blocks/EQpQ_SET_VAR_E",
            start: 406703,
            end: 407079
        }, {
            filename: "/assets/blocks/ET_IF_EEE",
            start: 407079,
            end: 407443
        }, {
            filename: "/assets/blocks/ET_INSPECT_E",
            start: 407443,
            end: 407792
        }, {
            filename: "/assets/blocks/ET_SET_VAR_E",
            start: 407792,
            end: 408042
        }, {
            filename: "/assets/blocks/ETpT_SET_VAR_E",
            start: 408042,
            end: 408416
        }, {
            filename: "/assets/blocks/EVQF_SET_CAM_E",
            start: 408416,
            end: 408866
        }, {
            filename: "/assets/blocks/EVQ_SET_LIT_E",
            start: 408866,
            end: 409263
        }, {
            filename: "/assets/blocks/EV_INSPECT_E",
            start: 409263,
            end: 409611
        }, {
            filename: "/assets/blocks/EV_SET_GRAVITY_E",
            start: 409611,
            end: 409990
        }, {
            filename: "/assets/blocks/EV_SET_VAR_E",
            start: 409990,
            end: 410242
        }, {
            filename: "/assets/blocks/EVpV_SET_VAR_E",
            start: 410242,
            end: 410617
        }, {
            filename: "/assets/blocks/E_BUT_SENSOR_EE",
            start: 410617,
            end: 410987
        }, {
            filename: "/assets/blocks/E_JOY_SENSOR_VE",
            start: 410987,
            end: 411349
        }, {
            filename: "/assets/blocks/E_LATE_UPDATE_EE",
            start: 411349,
            end: 411714
        }, {
            filename: "/assets/blocks/E_LOSE_E",
            start: 411714,
            end: 412087
        }, {
            filename: "/assets/blocks/E_PLAY_EE",
            start: 412087,
            end: 412449
        }, {
            filename: "/assets/blocks/E_SCREENSHOT_EE",
            start: 412449,
            end: 412838
        }, {
            filename: "/assets/blocks/E_SWIPE_EVE",
            start: 412838,
            end: 413210
        }, {
            filename: "/assets/blocks/E_TOUCH_EFFE",
            start: 413210,
            end: 413645
        }, {
            filename: "/assets/blocks/E_WIN_E",
            start: 413645,
            end: 414022
        }, {
            filename: "/assets/blocks/FALSE_T",
            start: 414022,
            end: 414269
        }, {
            filename: "/assets/blocks/FFF_EULER_Q",
            start: 414269,
            end: 414658
        }, {
            filename: "/assets/blocks/FFF_JOIN_V",
            start: 414658,
            end: 415045
        }, {
            filename: "/assets/blocks/FF_ADD_F",
            start: 415045,
            end: 415344
        }, {
            filename: "/assets/blocks/FF_DIV_F",
            start: 415344,
            end: 415638
        }, {
            filename: "/assets/blocks/FF_EQL_T",
            start: 415638,
            end: 415939
        }, {
            filename: "/assets/blocks/FF_GT_T",
            start: 415939,
            end: 416248
        }, {
            filename: "/assets/blocks/FF_LOG_F",
            start: 416248,
            end: 416564
        }, {
            filename: "/assets/blocks/FF_LT_T",
            start: 416564,
            end: 416871
        }, {
            filename: "/assets/blocks/FF_MAX_F",
            start: 416871,
            end: 417176
        }, {
            filename: "/assets/blocks/FF_MIN_F",
            start: 417176,
            end: 417482
        }, {
            filename: "/assets/blocks/FF_MOD_F",
            start: 417482,
            end: 417776
        }, {
            filename: "/assets/blocks/FF_MUL_F",
            start: 417776,
            end: 418081
        }, {
            filename: "/assets/blocks/FF_POW_F",
            start: 418081,
            end: 418380
        }, {
            filename: "/assets/blocks/FF_RANDOM_F",
            start: 418380,
            end: 418696
        }, {
            filename: "/assets/blocks/FF_S2W_VV",
            start: 418696,
            end: 419027
        }, {
            filename: "/assets/blocks/FF_SUB_F",
            start: 419027,
            end: 419325
        }, {
            filename: "/assets/blocks/FLOWERS",
            start: 419325,
            end: 419462
        }, {
            filename: "/assets/blocks/FOLDER_EMPTY",
            start: 419462,
            end: 419602
        }, {
            filename: "/assets/blocks/FOLDER_LOCKED",
            start: 419602,
            end: 419795
        }, {
            filename: "/assets/blocks/FOLDER_UNKNOWN",
            start: 419795,
            end: 419960
        }, {
            filename: "/assets/blocks/FOLIAGE",
            start: 419960,
            end: 420052
        }, {
            filename: "/assets/blocks/FOLIAGE_B",
            start: 420052,
            end: 420227
        }, {
            filename: "/assets/blocks/FOLIAGE_BOT",
            start: 420227,
            end: 420360
        }, {
            filename: "/assets/blocks/FOLIAGE_SLAB",
            start: 420360,
            end: 420521
        }, {
            filename: "/assets/blocks/FOLIAGE_TOP",
            start: 420521,
            end: 420650
        }, {
            filename: "/assets/blocks/FRAME_F",
            start: 420650,
            end: 420860
        }, {
            filename: "/assets/blocks/F_ABS_F",
            start: 420860,
            end: 421077
        }, {
            filename: "/assets/blocks/F_CEIL_F",
            start: 421077,
            end: 421295
        }, {
            filename: "/assets/blocks/F_COS_F",
            start: 421295,
            end: 421513
        }, {
            filename: "/assets/blocks/F_FLOOR_F",
            start: 421513,
            end: 421734
        }, {
            filename: "/assets/blocks/F_NEG_F",
            start: 421734,
            end: 421947
        }, {
            filename: "/assets/blocks/F_ROUND_F",
            start: 421947,
            end: 422167
        }, {
            filename: "/assets/blocks/F_SIN_F",
            start: 422167,
            end: 422389
        }, {
            filename: "/assets/blocks/FpF_LIST_ELEMENT_Fp",
            start: 422389,
            end: 422751
        }, {
            filename: "/assets/blocks/GOAL",
            start: 422751,
            end: 423190
        }, {
            filename: "/assets/blocks/GRASS_A",
            start: 423190,
            end: 423333
        }, {
            filename: "/assets/blocks/GRASS_B",
            start: 423333,
            end: 423495
        }, {
            filename: "/assets/blocks/IO",
            start: 423495,
            end: 423599
        }, {
            filename: "/assets/blocks/L2R",
            start: 423599,
            end: 423707
        }, {
            filename: "/assets/blocks/MARKER",
            start: 423707,
            end: 423820
        }, {
            filename: "/assets/blocks/MOTOR_X",
            start: 423820,
            end: 424451
        }, {
            filename: "/assets/blocks/MOTOR_Y",
            start: 424451,
            end: 425308
        }, {
            filename: "/assets/blocks/MOTOR_Z",
            start: 425308,
            end: 425965
        }, {
            filename: "/assets/blocks/MULTI_IN",
            start: 425965,
            end: 426074
        }, {
            filename: "/assets/blocks/MULTI_IN_E",
            start: 426074,
            end: 426187
        }, {
            filename: "/assets/blocks/MULTI_OUT",
            start: 426187,
            end: 426299
        }, {
            filename: "/assets/blocks/MULTI_OUT_E",
            start: 426299,
            end: 426414
        }, {
            filename: "/assets/blocks/NONE",
            start: 426414,
            end: 426624
        }, {
            filename: "/assets/blocks/NUMBER_F",
            start: 426624,
            end: 426873
        }, {
            filename: "/assets/blocks/OBSTACLE",
            start: 426873,
            end: 427001
        }, {
            filename: "/assets/blocks/OO_EQL_T",
            start: 427001,
            end: 427304
        }, {
            filename: "/assets/blocks/O_GET_POS_VQ",
            start: 427304,
            end: 427638
        }, {
            filename: "/assets/blocks/O_GET_SIZE_VV",
            start: 427638,
            end: 427962
        }, {
            filename: "/assets/blocks/O_GET_VEL_VV",
            start: 427962,
            end: 428294
        }, {
            filename: "/assets/blocks/OpF_LIST_ELEMENT_Op",
            start: 428294,
            end: 428655
        }, {
            filename: "/assets/blocks/PARTICLE",
            start: 428655,
            end: 428767
        }, {
            filename: "/assets/blocks/PASS_THROUGH",
            start: 428767,
            end: 428891
        }, {
            filename: "/assets/blocks/QQF_LERP_Q",
            start: 428891,
            end: 429280
        }, {
            filename: "/assets/blocks/QQ_MUL_Q",
            start: 429280,
            end: 429583
        }, {
            filename: "/assets/blocks/QUATERNION_Q",
            start: 429583,
            end: 429928
        }, {
            filename: "/assets/blocks/Q_EULER_FFF",
            start: 429928,
            end: 430317
        }, {
            filename: "/assets/blocks/Q_INV_Q",
            start: 430317,
            end: 430532
        }, {
            filename: "/assets/blocks/QpF_LIST_ELEMENT_Qp",
            start: 430532,
            end: 430896
        }, {
            filename: "/assets/blocks/SCREEN_SIZE_FF",
            start: 430896,
            end: 431211
        }, {
            filename: "/assets/blocks/SCRIPT",
            start: 431211,
            end: 431357
        }, {
            filename: "/assets/blocks/SFX_Fp",
            start: 431357,
            end: 431679
        }, {
            filename: "/assets/blocks/SHRUB",
            start: 431679,
            end: 431878
        }, {
            filename: "/assets/blocks/SLATE",
            start: 431878,
            end: 431972
        }, {
            filename: "/assets/blocks/SLATE_B",
            start: 431972,
            end: 432177
        }, {
            filename: "/assets/blocks/SLATE_BOT",
            start: 432177,
            end: 432315
        }, {
            filename: "/assets/blocks/SLATE_NE",
            start: 432315,
            end: 432428
        }, {
            filename: "/assets/blocks/SLATE_NW",
            start: 432428,
            end: 432548
        }, {
            filename: "/assets/blocks/SLATE_SE",
            start: 432548,
            end: 432664
        }, {
            filename: "/assets/blocks/SLATE_SW",
            start: 432664,
            end: 432784
        }, {
            filename: "/assets/blocks/SLATE_TOP",
            start: 432784,
            end: 432908
        }, {
            filename: "/assets/blocks/SLIDER",
            start: 432908,
            end: 434810
        }, {
            filename: "/assets/blocks/SLIDER_X",
            start: 434810,
            end: 435090
        }, {
            filename: "/assets/blocks/SLIDER_Y",
            start: 435090,
            end: 435411
        }, {
            filename: "/assets/blocks/SLIDER_Z",
            start: 435411,
            end: 435709
        }, {
            filename: "/assets/blocks/SPHERE",
            start: 435709,
            end: 435849
        }, {
            filename: "/assets/blocks/STEEL",
            start: 435849,
            end: 435989
        }, {
            filename: "/assets/blocks/STICK_DE",
            start: 435989,
            end: 436140
        }, {
            filename: "/assets/blocks/STICK_DN",
            start: 436140,
            end: 436292
        }, {
            filename: "/assets/blocks/STICK_DS",
            start: 436292,
            end: 436449
        }, {
            filename: "/assets/blocks/STICK_DW",
            start: 436449,
            end: 436607
        }, {
            filename: "/assets/blocks/STICK_NE",
            start: 436607,
            end: 436761
        }, {
            filename: "/assets/blocks/STICK_NW",
            start: 436761,
            end: 436924
        }, {
            filename: "/assets/blocks/STICK_SE",
            start: 436924,
            end: 437081
        }, {
            filename: "/assets/blocks/STICK_SW",
            start: 437081,
            end: 437241
        }, {
            filename: "/assets/blocks/STICK_UE",
            start: 437241,
            end: 437395
        }, {
            filename: "/assets/blocks/STICK_UN",
            start: 437395,
            end: 437565
        }, {
            filename: "/assets/blocks/STICK_US",
            start: 437565,
            end: 437722
        }, {
            filename: "/assets/blocks/STICK_UW",
            start: 437722,
            end: 437877
        }, {
            filename: "/assets/blocks/STICK_X",
            start: 437877,
            end: 438019
        }, {
            filename: "/assets/blocks/STICK_Y",
            start: 438019,
            end: 438168
        }, {
            filename: "/assets/blocks/STICK_Z",
            start: 438168,
            end: 438306
        }, {
            filename: "/assets/blocks/STONE",
            start: 438306,
            end: 438400
        }, {
            filename: "/assets/blocks/STONE_B",
            start: 438400,
            end: 438577
        }, {
            filename: "/assets/blocks/STONE_BLOCK",
            start: 438577,
            end: 438775
        }, {
            filename: "/assets/blocks/STONE_BOT",
            start: 438775,
            end: 438913
        }, {
            filename: "/assets/blocks/STONE_LOWER",
            start: 438913,
            end: 439054
        }, {
            filename: "/assets/blocks/STONE_PILLAR",
            start: 439054,
            end: 439209
        }, {
            filename: "/assets/blocks/STONE_SLAB",
            start: 439209,
            end: 439357
        }, {
            filename: "/assets/blocks/STONE_TOP",
            start: 439357,
            end: 439482
        }, {
            filename: "/assets/blocks/SWIPE_CHICK",
            start: 439482,
            end: 442259
        }, {
            filename: "/assets/blocks/THIS_O",
            start: 442259,
            end: 442374
        }, {
            filename: "/assets/blocks/TILT_BALL",
            start: 442374,
            end: 442621
        }, {
            filename: "/assets/blocks/TRUE_T",
            start: 442621,
            end: 442867
        }, {
            filename: "/assets/blocks/TT_AND_T",
            start: 442867,
            end: 443160
        }, {
            filename: "/assets/blocks/TT_EQL_T",
            start: 443160,
            end: 443461
        }, {
            filename: "/assets/blocks/TT_OR_T",
            start: 443461,
            end: 443752
        }, {
            filename: "/assets/blocks/T_NOT_T",
            start: 443752,
            end: 443966
        }, {
            filename: "/assets/blocks/TpF_LIST_ELEMENT_Tp",
            start: 443966,
            end: 444328
        }, {
            filename: "/assets/blocks/VAR_Cp",
            start: 444328,
            end: 444581
        }, {
            filename: "/assets/blocks/VAR_Fp",
            start: 444581,
            end: 444830
        }, {
            filename: "/assets/blocks/VAR_Op",
            start: 444830,
            end: 445080
        }, {
            filename: "/assets/blocks/VAR_Qp",
            start: 445080,
            end: 445332
        }, {
            filename: "/assets/blocks/VAR_Tp",
            start: 445332,
            end: 445582
        }, {
            filename: "/assets/blocks/VAR_Vp",
            start: 445582,
            end: 445832
        }, {
            filename: "/assets/blocks/VECTOR_V",
            start: 445832,
            end: 446175
        }, {
            filename: "/assets/blocks/VF_AXIS_ANG_Q",
            start: 446175,
            end: 446500
        }, {
            filename: "/assets/blocks/VF_MUL_V",
            start: 446500,
            end: 446801
        }, {
            filename: "/assets/blocks/VQ_MUL_V",
            start: 446801,
            end: 447103
        }, {
            filename: "/assets/blocks/VVVV_LINE_VS_PLANE_V",
            start: 447103,
            end: 447548
        }, {
            filename: "/assets/blocks/VV_ADD_V",
            start: 447548,
            end: 447847
        }, {
            filename: "/assets/blocks/VV_CROSS_V",
            start: 447847,
            end: 448152
        }, {
            filename: "/assets/blocks/VV_DIST_F",
            start: 448152,
            end: 448451
        }, {
            filename: "/assets/blocks/VV_DOT_F",
            start: 448451,
            end: 448764
        }, {
            filename: "/assets/blocks/VV_EQL_T",
            start: 448764,
            end: 449066
        }, {
            filename: "/assets/blocks/VV_LOOK_ROT_Q",
            start: 449066,
            end: 449393
        }, {
            filename: "/assets/blocks/VV_RAYCAST_TVO",
            start: 449393,
            end: 449778
        }, {
            filename: "/assets/blocks/VV_SUB_V",
            start: 449778,
            end: 450076
        }, {
            filename: "/assets/blocks/V_NORMALIZE_V",
            start: 450076,
            end: 450300
        }, {
            filename: "/assets/blocks/V_SPLIT_FFF",
            start: 450300,
            end: 450686
        }, {
            filename: "/assets/blocks/V_W2S_FF",
            start: 450686,
            end: 451018
        }, {
            filename: "/assets/blocks/VpF_LIST_ELEMENT_Vp",
            start: 451018,
            end: 451381
        }, {
            filename: "/assets/blocks/WHEEL",
            start: 451381,
            end: 453122
        }, {
            filename: "/assets/blocks/WOOD_LOWER_X",
            start: 453122,
            end: 453313
        }, {
            filename: "/assets/blocks/WOOD_LOWER_Z",
            start: 453313,
            end: 453503
        }, {
            filename: "/assets/blocks/WOOD_UPPER_X",
            start: 453503,
            end: 453694
        }, {
            filename: "/assets/blocks/WOOD_UPPER_Z",
            start: 453694,
            end: 453884
        }, {
            filename: "/assets/blocks/WOOD_X",
            start: 453884,
            end: 454059
        }, {
            filename: "/assets/blocks/WOOD_Y",
            start: 454059,
            end: 454249
        }, {
            filename: "/assets/blocks/WOOD_Z",
            start: 454249,
            end: 454420
        }, {
            filename: "/assets/db",
            start: 454420,
            end: 454662
        }, {
            filename: "/assets/games/5F084A0BCE06B710",
            start: 454662,
            end: 656508
        }, {
            filename: "/assets/games/menu",
            start: 656508,
            end: 662487
        }, {
            filename: "/assets/games/menu_drive_mad",
            start: 662487,
            end: 666281
        }, {
            filename: "/assets/sounds/146721_ui_beep.wav",
            start: 666281,
            end: 670783,
            audio: 1
        }, {
            filename: "/assets/sounds/188204_scrape.wav",
            start: 670783,
            end: 702819,
            audio: 1
        }, {
            filename: "/assets/sounds/194795_ui_button.wav",
            start: 702819,
            end: 704921,
            audio: 1
        }, {
            filename: "/assets/sounds/240566_screenshot_done.wav",
            start: 704921,
            end: 709075,
            audio: 1
        }, {
            filename: "/assets/sounds/249929_splash1.wav",
            start: 709075,
            end: 720779,
            audio: 1
        }, {
            filename: "/assets/sounds/257357_button.wav",
            start: 720779,
            end: 722143,
            audio: 1
        }, {
            filename: "/assets/sounds/315935_bang.wav",
            start: 722143,
            end: 774653,
            audio: 1
        }, {
            filename: "/assets/sounds/319154_block_open.wav",
            start: 774653,
            end: 784175,
            audio: 1
        }, {
            filename: "/assets/sounds/363090_coin.wav",
            start: 784175,
            end: 788933,
            audio: 1
        }, {
            filename: "/assets/sounds/36837_engine_no_click.wav",
            start: 788933,
            end: 800971,
            audio: 1
        }, {
            filename: "/assets/sounds/378355_ball.wav",
            start: 800971,
            end: 809137,
            audio: 1
        }, {
            filename: "/assets/sounds/399095_jump.wav",
            start: 809137,
            end: 814515,
            audio: 1
        }, {
            filename: "/assets/sounds/411911_chirp.wav",
            start: 814515,
            end: 823387,
            audio: 1
        }, {
            filename: "/assets/sounds/521481_camera.wav",
            start: 823387,
            end: 838819,
            audio: 1
        }, {
            filename: "/assets/sounds/78937_squeek.wav",
            start: 838819,
            end: 848929,
            audio: 1
        }, {
            filename: "/assets/sounds/chaching.wav",
            start: 848929,
            end: 898209,
            audio: 1
        }, {
            filename: "/assets/sounds/coin02_band.wav",
            start: 898209,
            end: 910193,
            audio: 1
        }, {
            filename: "/assets/sounds/error1.wav",
            start: 910193,
            end: 931453,
            audio: 1
        }, {
            filename: "/assets/sounds/floor6.wav",
            start: 931453,
            end: 962477,
            audio: 1
        }, {
            filename: "/assets/sounds/khz1_pipey_c3.wav",
            start: 962477,
            end: 1095625,
            audio: 1
        }, {
            filename: "/assets/sounds/win.wav",
            start: 1095625,
            end: 1166589,
            audio: 1
        }, {
            filename: "/assets/views/baloo2.woff",
            start: 1166589,
            end: 1190661
        }, {
            filename: "/assets/views/block_settings.html",
            start: 1190661,
            end: 1192650
        }, {
            filename: "/assets/views/common.css",
            start: 1192650,
            end: 1197923
        }, {
            filename: "/assets/views/common.js",
            start: 1197923,
            end: 1205594
        }, {
            filename: "/assets/views/confirm_deletion.html",
            start: 1205594,
            end: 1207885
        }, {
            filename: "/assets/views/create_user.html",
            start: 1207885,
            end: 1210043
        }, {
            filename: "/assets/views/editor_script.html",
            start: 1210043,
            end: 1218053
        }, {
            filename: "/assets/views/editor_script_blockly.html",
            start: 1218053,
            end: 1230479
        }, {
            filename: "/assets/views/game_moderation.html",
            start: 1230479,
            end: 1234993
        }, {
            filename: "/assets/views/messagebox.html",
            start: 1234993,
            end: 1237032
        }, {
            filename: "/assets/views/show_hint.html",
            start: 1237032,
            end: 1238474
        }, {
            filename: "/assets/views/sign_in.html",
            start: 1238474,
            end: 1240875
        }],
        remote_package_size: 1240875
    })
}
)();
var moduleOverrides = Object.assign({}, Module);
var arguments_ = [];
var thisProgram = "./this.program";
var quit_ = (status,toThrow)=>{
    throw toThrow
}
;
var scriptDirectory = "";
function locateFile(path) {
    if (Module["locateFile"]) {
        return Module["locateFile"](path, scriptDirectory)
    }
    return scriptDirectory + path
}
var readAsync, readBinary;
if (ENVIRONMENT_IS_NODE) {
    var fs = require("fs");
    var nodePath = require("path");
    scriptDirectory = __dirname + "/";
    readBinary = filename=>{
        filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
        var ret = fs.readFileSync(filename);
        return ret
    }
    ;
    readAsync = (filename,binary=true)=>{
        filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
        return new Promise((resolve,reject)=>{
            fs.readFile(filename, binary ? undefined : "utf8", (err,data)=>{
                if (err)
                    reject(err);
                else
                    resolve(binary ? data.buffer : data)
            }
            )
        }
        )
    }
    ;
    if (!Module["thisProgram"] && process.argv.length > 1) {
        thisProgram = process.argv[1].replace(/\\/g, "/")
    }
    arguments_ = process.argv.slice(2);
    if (typeof module != "undefined") {
        module["exports"] = Module
    }
    quit_ = (status,toThrow)=>{
        process.exitCode = status;
        throw toThrow
    }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href
    } else if (typeof document != "undefined" && document.currentScript) {
        scriptDirectory = document.currentScript.src
    }
    if (scriptDirectory.startsWith("blob:")) {
        scriptDirectory = ""
    } else {
        scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1)
    }
    {
        if (ENVIRONMENT_IS_WORKER) {
            readBinary = url=>{
                var xhr = new XMLHttpRequest;
                xhr.open("GET", url, false);
                xhr.responseType = "arraybuffer";
                xhr.send(null);
                return new Uint8Array(xhr.response)
            }
        }
        readAsync = url=>{
            if (isFileURI(url)) {
                return new Promise((resolve,reject)=>{
                    var xhr = new XMLHttpRequest;
                    xhr.open("GET", url, true);
                    xhr.responseType = "arraybuffer";
                    xhr.onload = ()=>{
                        if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                            resolve(xhr.response);
                            return
                        }
                        reject(xhr.status)
                    }
                    ;
                    xhr.onerror = reject;
                    xhr.send(null)
                }
                )
            }
            return fetch(url, {
                credentials: "same-origin"
            }).then(response=>{
                if (response.ok) {
                    return response.arrayBuffer()
                }
                return Promise.reject(new Error(response.status + " : " + response.url))
            }
            )
        }
    }
} else {}
var out = Module["print"] || console.log.bind(console);
var err = Module["printErr"] || console.error.bind(console);
Object.assign(Module, moduleOverrides);
moduleOverrides = null;
if (Module["arguments"])
    arguments_ = Module["arguments"];
if (Module["thisProgram"])
    thisProgram = Module["thisProgram"];
var wasmBinary = Module["wasmBinary"];
var wasmMemory;
var ABORT = false;
var EXITSTATUS;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
function updateMemoryViews() {
    var b = wasmMemory.buffer;
    Module["HEAP8"] = HEAP8 = new Int8Array(b);
    Module["HEAP16"] = HEAP16 = new Int16Array(b);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
    Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
    Module["HEAP32"] = HEAP32 = new Int32Array(b);
    Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
    Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
    Module["HEAPF64"] = HEAPF64 = new Float64Array(b)
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
function preRun() {
    if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function")
            Module["preRun"] = [Module["preRun"]];
        while (Module["preRun"].length) {
            addOnPreRun(Module["preRun"].shift())
        }
    }
    callRuntimeCallbacks(__ATPRERUN__)
}
function initRuntime() {
    runtimeInitialized = true;
    if (!Module["noFSInit"] && !FS.initialized)
        FS.init();
    FS.ignorePermissions = false;
    TTY.init();
    callRuntimeCallbacks(__ATINIT__)
}
function preMain() {
    callRuntimeCallbacks(__ATMAIN__)
}
function postRun() {
    if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function")
            Module["postRun"] = [Module["postRun"]];
        while (Module["postRun"].length) {
            addOnPostRun(Module["postRun"].shift())
        }
    }
    callRuntimeCallbacks(__ATPOSTRUN__)
}
function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb)
}
function addOnInit(cb) {
    __ATINIT__.unshift(cb)
}
function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb)
}
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
function getUniqueRunDependency(id) {
    return id
}
function addRunDependency(id) {
    runDependencies++;
    Module["monitorRunDependencies"]?.(runDependencies)
}
function removeRunDependency(id) {
    runDependencies--;
    Module["monitorRunDependencies"]?.(runDependencies);
    if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null
        }
        if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback()
        }
    }
}
function abort(what) {
    Module["onAbort"]?.(what);
    what = "Aborted(" + what + ")";
    err(what);
    ABORT = true;
    what += ". Build with -sASSERTIONS for more info.";
    var e = new WebAssembly.RuntimeError(what);
    throw e
}
var dataURIPrefix = "data:application/octet-stream;base64,";
var isDataURI = filename=>filename.startsWith(dataURIPrefix);
var isFileURI = filename=>filename.startsWith("file://");
function findWasmBinary() {
    var f = "index.wasm";
    if (!isDataURI(f)) {
        return locateFile(f)
    }
    return f
}
var wasmBinaryFile;
function getBinarySync(file) {
    if (file == wasmBinaryFile && wasmBinary) {
        return new Uint8Array(wasmBinary)
    }
    if (readBinary) {
        return readBinary(file)
    }
    throw "both async and sync fetching of the wasm failed"
}
function getBinaryPromise(binaryFile) {
    if (!wasmBinary) {
        return readAsync(binaryFile).then(response=>new Uint8Array(response), ()=>getBinarySync(binaryFile))
    }
    return Promise.resolve().then(()=>getBinarySync(binaryFile))
}
function instantiateArrayBuffer(binaryFile, imports, receiver) {
    return getBinaryPromise(binaryFile).then(binary=>WebAssembly.instantiate(binary, imports)).then(receiver, reason=>{
        err(`failed to asynchronously prepare wasm: ${reason}`);
        abort(reason)
    }
    )
}
function instantiateAsync(binary, binaryFile, imports, callback) {
    if (!binary && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(binaryFile) && !isFileURI(binaryFile) && !ENVIRONMENT_IS_NODE && typeof fetch == "function") {
        return fetch(binaryFile, {
            credentials: "same-origin"
        }).then(response=>{
            var result = WebAssembly.instantiateStreaming(response, imports);
            return result.then(callback, function(reason) {
                err(`wasm streaming compile failed: ${reason}`);
                err("falling back to ArrayBuffer instantiation");
                return instantiateArrayBuffer(binaryFile, imports, callback)
            })
        }
        )
    }
    return instantiateArrayBuffer(binaryFile, imports, callback)
}
function getWasmImports() {
    return {
        a: wasmImports
    }
}
function createWasm() {
    var info = getWasmImports();
    function receiveInstance(instance, module) {
        wasmExports = instance.exports;
        wasmMemory = wasmExports["db"];
        updateMemoryViews();
        wasmTable = wasmExports["rb"];
        addOnInit(wasmExports["eb"]);
        removeRunDependency("wasm-instantiate");
        return wasmExports
    }
    addRunDependency("wasm-instantiate");
    function receiveInstantiationResult(result) {
        receiveInstance(result["instance"])
    }
    if (Module["instantiateWasm"]) {
        try {
            return Module["instantiateWasm"](info, receiveInstance)
        } catch (e) {
            err(`Module.instantiateWasm callback failed with error: ${e}`);
            return false
        }
    }
    wasmBinaryFile ??= findWasmBinary();
    instantiateAsync(wasmBinary, wasmBinaryFile, info, receiveInstantiationResult);
    return {}
}
var tempDouble;
var tempI64;
var ASM_CONSTS = {
    672792: $0=>{
        downloadFileInBrowser(UTF8ToString($0))
    }
    ,
    672834: ($0,$1,$2)=>{
        fetchUrl(UTF8ToString($0), $1, $2)
    }
    ,
    672871: $0=>{
        webViewOpen(UTF8ToString($0))
    }
    ,
    672904: ()=>{
        webViewClose()
    }
    ,
    672922: $0=>{
        webViewExecuteJS(UTF8ToString($0))
    }
    ,
    672960: ($0,$1)=>{
        Audio.init($0, $1)
    }
    ,
    672984: ()=>{
        Audio.deinit()
    }
    ,
    673004: ()=>{
        Audio.pause()
    }
    ,
    673023: ()=>{
        Audio.resume()
    }
    ,
    673043: ()=>{
        hideOverlayGradient()
    }
    ,
    673068: ()=>{
        if (fsSyncStatus === "to")
            return;
        fsSyncStatus = "to";
        FS.syncfs(false, function(err) {
            if (err) {
                simpleLogC("syncfs error " + err)
            }
            fsSyncStatus = ""
        })
    }
    ,
    673229: ()=>{
        if (fsSyncStatus === "from")
            return;
        fsSyncStatus = "from";
        FS.syncfs(true, function(err) {
            if (err) {
                simpleLogC("syncfs error " + err)
            }
            fsSyncStatus = ""
        })
    }
    ,
    673393: ()=>{
        firebaseSignout()
    }
    ,
    673414: ()=>{
        adInit()
    }
    ,
    673428: ()=>{
        adInterstitialShow()
    }
    ,
    673454: ()=>{
        adRewardedShow()
    }
    ,
    673476: ()=>{
        adInterstitialLoad()
    }
    ,
    673502: ()=>{
        adInterstitialShow()
    }
    ,
    673528: ()=>{
        adRewardedLoad()
    }
    ,
    673550: ($0,$1,$2)=>{
        adRewardedShow(UTF8ToString($0), UTF8ToString($1), UTF8ToString($2))
    }
    ,
    673624: ()=>{
        adInit()
    }
    ,
    673638: ($0,$1,$2)=>{
        showShareFileModal(UTF8ToString($0), UTF8ToString($1), UTF8ToString($2))
    }
    ,
    673713: $0=>{
        window.open(UTF8ToString($0), "_blank")
    }
    ,
    673758: ()=>{
        location.reload()
    }
    ,
    673781: ($0,$1,$2,$3)=>{
        showStoreLinkModal(UTF8ToString($0), $1, $2, $3)
    }
    ,
    673833: ()=>{
        FS.mkdir("/sandbox");
        FS.mount(IDBFS, {}, "/sandbox");
        FS.syncfs(true, function(err) {
            if (err) {
                simpleLogC("syncfs error " + err)
            }
            try {
                ccall("app_init", "v")
            } catch (err) {
                let play_content = document.getElementById("play_content");
                let error_text = document.createElement("p");
                error_text.classList.add("error_message");
                error_text.textContent = err;
                play_content.appendChild(error_text);
                throw err
            }
            hideOverlay()
        })
    }
    ,
    674268: ()=>document.getElementById("canvas").width,
    674318: ()=>document.getElementById("canvas").height,
    674369: ($0,$1)=>{
        checkHintFileExist(UTF8ToString($0), $1)
    }
    ,
    674413: $0=>{
        setDeepLinkLoadingFraction($0)
    }
    ,
    674446: ()=>{
        hideOverlayGradient()
    }
    ,
    674471: $0=>{
        Storage.init($0)
    }
    ,
    674493: $0=>{
        Storage.remove($0)
    }
    ,
    674517: ($0,$1,$2)=>{
        Storage.write($0, $1, $2)
    }
    ,
    674548: ()=>{
        try {
            PokiSDK.customEvent("game", "segment", {
                label: "level",
                value: li.toString()
            })
        } catch (err) {}
        pokiSendLevelData()
    }
    ,
    674678: ()=>{
        pokiEnsureStop()
    }
    ,
    674700: ()=>{
        pokiEnsureStart()
    }
};
function is_daily_reward_possible() {
    return dailyRewardPossible
}
function is_latest_browser_tab() {
    try {
        return localStorage["startup-time"] == startupTimeStr
    } catch (err) {
        return true
    }
}
function set_latest_browser_tab() {
    startupTimeStr = Date.now().toString();
    try {
        localStorage["startup-time"] = startupTimeStr
    } catch (err) {}
}
function get_device_pixel_ratio() {
    return window.devicePixelRatio
}
function get_hostname() {
    return getHostname()
}
function get_url_level_index() {
    return getUrlLevelIndex()
}
function ExitStatus(status) {
    this.name = "ExitStatus";
    this.message = `Program terminated with exit(${status})`;
    this.status = status
}
var callRuntimeCallbacks = callbacks=>{
    while (callbacks.length > 0) {
        callbacks.shift()(Module)
    }
}
;
function getValue(ptr, type="i8") {
    if (type.endsWith("*"))
        type = "*";
    switch (type) {
    case "i1":
        return HEAP8[ptr];
    case "i8":
        return HEAP8[ptr];
    case "i16":
        return HEAP16[ptr >> 1];
    case "i32":
        return HEAP32[ptr >> 2];
    case "i64":
        abort("to do getValue(i64) use WASM_BIGINT");
    case "float":
        return HEAPF32[ptr >> 2];
    case "double":
        return HEAPF64[ptr >> 3];
    case "*":
        return HEAPU32[ptr >> 2];
    default:
        abort(`invalid type for getValue: ${type}`)
    }
}
var noExitRuntime = Module["noExitRuntime"] || true;
var stackRestore = val=>__emscripten_stack_restore(val);
var stackSave = ()=>_emscripten_stack_get_current();
var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder : undefined;
var UTF8ArrayToString = (heapOrArray,idx,maxBytesToRead)=>{
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;
    while (heapOrArray[endPtr] && !(endPtr >= endIdx))
        ++endPtr;
    if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr))
    }
    var str = "";
    while (idx < endPtr) {
        var u0 = heapOrArray[idx++];
        if (!(u0 & 128)) {
            str += String.fromCharCode(u0);
            continue
        }
        var u1 = heapOrArray[idx++] & 63;
        if ((u0 & 224) == 192) {
            str += String.fromCharCode((u0 & 31) << 6 | u1);
            continue
        }
        var u2 = heapOrArray[idx++] & 63;
        if ((u0 & 240) == 224) {
            u0 = (u0 & 15) << 12 | u1 << 6 | u2
        } else {
            u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63
        }
        if (u0 < 65536) {
            str += String.fromCharCode(u0)
        } else {
            var ch = u0 - 65536;
            str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
        }
    }
    return str
}
;
var UTF8ToString = (ptr,maxBytesToRead)=>ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
var ___assert_fail = (condition,filename,line,func)=>{
    abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function"])
}
;
var PATH = {
    isAbs: path=>path.charAt(0) === "/",
    splitPath: filename=>{
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1)
    }
    ,
    normalizeArray: (parts,allowAboveRoot)=>{
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
            var last = parts[i];
            if (last === ".") {
                parts.splice(i, 1)
            } else if (last === "..") {
                parts.splice(i, 1);
                up++
            } else if (up) {
                parts.splice(i, 1);
                up--
            }
        }
        if (allowAboveRoot) {
            for (; up; up--) {
                parts.unshift("..")
            }
        }
        return parts
    }
    ,
    normalize: path=>{
        var isAbsolute = PATH.isAbs(path)
          , trailingSlash = path.substr(-1) === "/";
        path = PATH.normalizeArray(path.split("/").filter(p=>!!p), !isAbsolute).join("/");
        if (!path && !isAbsolute) {
            path = "."
        }
        if (path && trailingSlash) {
            path += "/"
        }
        return (isAbsolute ? "/" : "") + path
    }
    ,
    dirname: path=>{
        var result = PATH.splitPath(path)
          , root = result[0]
          , dir = result[1];
        if (!root && !dir) {
            return "."
        }
        if (dir) {
            dir = dir.substr(0, dir.length - 1)
        }
        return root + dir
    }
    ,
    basename: path=>{
        if (path === "/")
            return "/";
        path = PATH.normalize(path);
        path = path.replace(/\/$/, "");
        var lastSlash = path.lastIndexOf("/");
        if (lastSlash === -1)
            return path;
        return path.substr(lastSlash + 1)
    }
    ,
    join: (...paths)=>PATH.normalize(paths.join("/")),
    join2: (l,r)=>PATH.normalize(l + "/" + r)
};
var initRandomFill = ()=>{
    if (typeof crypto == "object" && typeof crypto["getRandomValues"] == "function") {
        return view=>crypto.getRandomValues(view)
    } else if (ENVIRONMENT_IS_NODE) {
        try {
            var crypto_module = require("crypto");
            var randomFillSync = crypto_module["randomFillSync"];
            if (randomFillSync) {
                return view=>crypto_module["randomFillSync"](view)
            }
            var randomBytes = crypto_module["randomBytes"];
            return view=>(view.set(randomBytes(view.byteLength)),
            view)
        } catch (e) {}
    }
    abort("initRandomDevice")
}
;
var randomFill = view=>(randomFill = initRandomFill())(view);
var PATH_FS = {
    resolve: (...args)=>{
        var resolvedPath = ""
          , resolvedAbsolute = false;
        for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
            var path = i >= 0 ? args[i] : FS.cwd();
            if (typeof path != "string") {
                throw new TypeError("Arguments to path.resolve must be strings")
            } else if (!path) {
                return ""
            }
            resolvedPath = path + "/" + resolvedPath;
            resolvedAbsolute = PATH.isAbs(path)
        }
        resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(p=>!!p), !resolvedAbsolute).join("/");
        return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
    }
    ,
    relative: (from,to)=>{
        from = PATH_FS.resolve(from).substr(1);
        to = PATH_FS.resolve(to).substr(1);
        function trim(arr) {
            var start = 0;
            for (; start < arr.length; start++) {
                if (arr[start] !== "")
                    break
            }
            var end = arr.length - 1;
            for (; end >= 0; end--) {
                if (arr[end] !== "")
                    break
            }
            if (start > end)
                return [];
            return arr.slice(start, end - start + 1)
        }
        var fromParts = trim(from.split("/"));
        var toParts = trim(to.split("/"));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
            if (fromParts[i] !== toParts[i]) {
                samePartsLength = i;
                break
            }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
            outputParts.push("..")
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join("/")
    }
};
var FS_stdin_getChar_buffer = [];
var lengthBytesUTF8 = str=>{
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        var c = str.charCodeAt(i);
        if (c <= 127) {
            len++
        } else if (c <= 2047) {
            len += 2
        } else if (c >= 55296 && c <= 57343) {
            len += 4;
            ++i
        } else {
            len += 3
        }
    }
    return len
}
;
var stringToUTF8Array = (str,heap,outIdx,maxBytesToWrite)=>{
    if (!(maxBytesToWrite > 0))
        return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) {
            var u1 = str.charCodeAt(++i);
            u = 65536 + ((u & 1023) << 10) | u1 & 1023
        }
        if (u <= 127) {
            if (outIdx >= endIdx)
                break;
            heap[outIdx++] = u
        } else if (u <= 2047) {
            if (outIdx + 1 >= endIdx)
                break;
            heap[outIdx++] = 192 | u >> 6;
            heap[outIdx++] = 128 | u & 63
        } else if (u <= 65535) {
            if (outIdx + 2 >= endIdx)
                break;
            heap[outIdx++] = 224 | u >> 12;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        } else {
            if (outIdx + 3 >= endIdx)
                break;
            heap[outIdx++] = 240 | u >> 18;
            heap[outIdx++] = 128 | u >> 12 & 63;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        }
    }
    heap[outIdx] = 0;
    return outIdx - startIdx
}
;
function intArrayFromString(stringy, dontAddNull, length) {
    var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
    var u8array = new Array(len);
    var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
    if (dontAddNull)
        u8array.length = numBytesWritten;
    return u8array
}
var FS_stdin_getChar = ()=>{
    if (!FS_stdin_getChar_buffer.length) {
        var result = null;
        if (ENVIRONMENT_IS_NODE) {
            var BUFSIZE = 256;
            var buf = Buffer.alloc(BUFSIZE);
            var bytesRead = 0;
            var fd = process.stdin.fd;
            try {
                bytesRead = fs.readSync(fd, buf, 0, BUFSIZE)
            } catch (e) {
                if (e.toString().includes("EOF"))
                    bytesRead = 0;
                else
                    throw e
            }
            if (bytesRead > 0) {
                result = buf.slice(0, bytesRead).toString("utf-8")
            }
        } else if (typeof window != "undefined" && typeof window.prompt == "function") {
            result = window.prompt("Input: ");
            if (result !== null) {
                result += "\n"
            }
        } else {}
        if (!result) {
            return null
        }
        FS_stdin_getChar_buffer = intArrayFromString(result, true)
    }
    return FS_stdin_getChar_buffer.shift()
}
;
var TTY = {
    ttys: [],
    init() {},
    shutdown() {},
    register(dev, ops) {
        TTY.ttys[dev] = {
            input: [],
            output: [],
            ops
        };
        FS.registerDevice(dev, TTY.stream_ops)
    },
    stream_ops: {
        open(stream) {
            var tty = TTY.ttys[stream.node.rdev];
            if (!tty) {
                throw new FS.ErrnoError(43)
            }
            stream.tty = tty;
            stream.seekable = false
        },
        close(stream) {
            stream.tty.ops.fsync(stream.tty)
        },
        fsync(stream) {
            stream.tty.ops.fsync(stream.tty)
        },
        read(stream, buffer, offset, length, pos) {
            if (!stream.tty || !stream.tty.ops.get_char) {
                throw new FS.ErrnoError(60)
            }
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
                var result;
                try {
                    result = stream.tty.ops.get_char(stream.tty)
                } catch (e) {
                    throw new FS.ErrnoError(29)
                }
                if (result === undefined && bytesRead === 0) {
                    throw new FS.ErrnoError(6)
                }
                if (result === null || result === undefined)
                    break;
                bytesRead++;
                buffer[offset + i] = result
            }
            if (bytesRead) {
                stream.node.timestamp = Date.now()
            }
            return bytesRead
        },
        write(stream, buffer, offset, length, pos) {
            if (!stream.tty || !stream.tty.ops.put_char) {
                throw new FS.ErrnoError(60)
            }
            try {
                for (var i = 0; i < length; i++) {
                    stream.tty.ops.put_char(stream.tty, buffer[offset + i])
                }
            } catch (e) {
                throw new FS.ErrnoError(29)
            }
            if (length) {
                stream.node.timestamp = Date.now()
            }
            return i
        }
    },
    default_tty_ops: {
        get_char(tty) {
            return FS_stdin_getChar()
        },
        put_char(tty, val) {
            if (val === null || val === 10) {
                out(UTF8ArrayToString(tty.output, 0));
                tty.output = []
            } else {
                if (val != 0)
                    tty.output.push(val)
            }
        },
        fsync(tty) {
            if (tty.output && tty.output.length > 0) {
                out(UTF8ArrayToString(tty.output, 0));
                tty.output = []
            }
        },
        ioctl_tcgets(tty) {
            return {
                c_iflag: 25856,
                c_oflag: 5,
                c_cflag: 191,
                c_lflag: 35387,
                c_cc: [3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            }
        },
        ioctl_tcsets(tty, optional_actions, data) {
            return 0
        },
        ioctl_tiocgwinsz(tty) {
            return [24, 80]
        }
    },
    default_tty1_ops: {
        put_char(tty, val) {
            if (val === null || val === 10) {
                err(UTF8ArrayToString(tty.output, 0));
                tty.output = []
            } else {
                if (val != 0)
                    tty.output.push(val)
            }
        },
        fsync(tty) {
            if (tty.output && tty.output.length > 0) {
                err(UTF8ArrayToString(tty.output, 0));
                tty.output = []
            }
        }
    }
};
var alignMemory = (size,alignment)=>Math.ceil(size / alignment) * alignment;
var mmapAlloc = size=>{
    abort()
}
;
var MEMFS = {
    ops_table: null,
    mount(mount) {
        return MEMFS.createNode(null, "/", 16384 | 511, 0)
    },
    createNode(parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
            throw new FS.ErrnoError(63)
        }
        MEMFS.ops_table ||= {
            dir: {
                node: {
                    getattr: MEMFS.node_ops.getattr,
                    setattr: MEMFS.node_ops.setattr,
                    lookup: MEMFS.node_ops.lookup,
                    mknod: MEMFS.node_ops.mknod,
                    rename: MEMFS.node_ops.rename,
                    unlink: MEMFS.node_ops.unlink,
                    rmdir: MEMFS.node_ops.rmdir,
                    readdir: MEMFS.node_ops.readdir,
                    symlink: MEMFS.node_ops.symlink
                },
                stream: {
                    llseek: MEMFS.stream_ops.llseek
                }
            },
            file: {
                node: {
                    getattr: MEMFS.node_ops.getattr,
                    setattr: MEMFS.node_ops.setattr
                },
                stream: {
                    llseek: MEMFS.stream_ops.llseek,
                    read: MEMFS.stream_ops.read,
                    write: MEMFS.stream_ops.write,
                    allocate: MEMFS.stream_ops.allocate,
                    mmap: MEMFS.stream_ops.mmap,
                    msync: MEMFS.stream_ops.msync
                }
            },
            link: {
                node: {
                    getattr: MEMFS.node_ops.getattr,
                    setattr: MEMFS.node_ops.setattr,
                    readlink: MEMFS.node_ops.readlink
                },
                stream: {}
            },
            chrdev: {
                node: {
                    getattr: MEMFS.node_ops.getattr,
                    setattr: MEMFS.node_ops.setattr
                },
                stream: FS.chrdev_stream_ops
            }
        };
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
            node.node_ops = MEMFS.ops_table.dir.node;
            node.stream_ops = MEMFS.ops_table.dir.stream;
            node.contents = {}
        } else if (FS.isFile(node.mode)) {
            node.node_ops = MEMFS.ops_table.file.node;
            node.stream_ops = MEMFS.ops_table.file.stream;
            node.usedBytes = 0;
            node.contents = null
        } else if (FS.isLink(node.mode)) {
            node.node_ops = MEMFS.ops_table.link.node;
            node.stream_ops = MEMFS.ops_table.link.stream
        } else if (FS.isChrdev(node.mode)) {
            node.node_ops = MEMFS.ops_table.chrdev.node;
            node.stream_ops = MEMFS.ops_table.chrdev.stream
        }
        node.timestamp = Date.now();
        if (parent) {
            parent.contents[name] = node;
            parent.timestamp = node.timestamp
        }
        return node
    },
    getFileDataAsTypedArray(node) {
        if (!node.contents)
            return new Uint8Array(0);
        if (node.contents.subarray)
            return node.contents.subarray(0, node.usedBytes);
        return new Uint8Array(node.contents)
    },
    expandFileStorage(node, newCapacity) {
        var prevCapacity = node.contents ? node.contents.length : 0;
        if (prevCapacity >= newCapacity)
            return;
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) >>> 0);
        if (prevCapacity != 0)
            newCapacity = Math.max(newCapacity, 256);
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity);
        if (node.usedBytes > 0)
            node.contents.set(oldContents.subarray(0, node.usedBytes), 0)
    },
    resizeFileStorage(node, newSize) {
        if (node.usedBytes == newSize)
            return;
        if (newSize == 0) {
            node.contents = null;
            node.usedBytes = 0
        } else {
            var oldContents = node.contents;
            node.contents = new Uint8Array(newSize);
            if (oldContents) {
                node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)))
            }
            node.usedBytes = newSize
        }
    },
    node_ops: {
        getattr(node) {
            var attr = {};
            attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
            attr.ino = node.id;
            attr.mode = node.mode;
            attr.nlink = 1;
            attr.uid = 0;
            attr.gid = 0;
            attr.rdev = node.rdev;
            if (FS.isDir(node.mode)) {
                attr.size = 4096
            } else if (FS.isFile(node.mode)) {
                attr.size = node.usedBytes
            } else if (FS.isLink(node.mode)) {
                attr.size = node.link.length
            } else {
                attr.size = 0
            }
            attr.atime = new Date(node.timestamp);
            attr.mtime = new Date(node.timestamp);
            attr.ctime = new Date(node.timestamp);
            attr.blksize = 4096;
            attr.blocks = Math.ceil(attr.size / attr.blksize);
            return attr
        },
        setattr(node, attr) {
            if (attr.mode !== undefined) {
                node.mode = attr.mode
            }
            if (attr.timestamp !== undefined) {
                node.timestamp = attr.timestamp
            }
            if (attr.size !== undefined) {
                MEMFS.resizeFileStorage(node, attr.size)
            }
        },
        lookup(parent, name) {
            throw FS.genericErrors[44]
        },
        mknod(parent, name, mode, dev) {
            return MEMFS.createNode(parent, name, mode, dev)
        },
        rename(old_node, new_dir, new_name) {
            if (FS.isDir(old_node.mode)) {
                var new_node;
                try {
                    new_node = FS.lookupNode(new_dir, new_name)
                } catch (e) {}
                if (new_node) {
                    for (var i in new_node.contents) {
                        throw new FS.ErrnoError(55)
                    }
                }
            }
            delete old_node.parent.contents[old_node.name];
            old_node.parent.timestamp = Date.now();
            old_node.name = new_name;
            new_dir.contents[new_name] = old_node;
            new_dir.timestamp = old_node.parent.timestamp
        },
        unlink(parent, name) {
            delete parent.contents[name];
            parent.timestamp = Date.now()
        },
        rmdir(parent, name) {
            var node = FS.lookupNode(parent, name);
            for (var i in node.contents) {
                throw new FS.ErrnoError(55)
            }
            delete parent.contents[name];
            parent.timestamp = Date.now()
        },
        readdir(node) {
            var entries = [".", ".."];
            for (var key of Object.keys(node.contents)) {
                entries.push(key)
            }
            return entries
        },
        symlink(parent, newname, oldpath) {
            var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
            node.link = oldpath;
            return node
        },
        readlink(node) {
            if (!FS.isLink(node.mode)) {
                throw new FS.ErrnoError(28)
            }
            return node.link
        }
    },
    stream_ops: {
        read(stream, buffer, offset, length, position) {
            var contents = stream.node.contents;
            if (position >= stream.node.usedBytes)
                return 0;
            var size = Math.min(stream.node.usedBytes - position, length);
            if (size > 8 && contents.subarray) {
                buffer.set(contents.subarray(position, position + size), offset)
            } else {
                for (var i = 0; i < size; i++)
                    buffer[offset + i] = contents[position + i]
            }
            return size
        },
        write(stream, buffer, offset, length, position, canOwn) {
            if (buffer.buffer === HEAP8.buffer) {
                canOwn = false
            }
            if (!length)
                return 0;
            var node = stream.node;
            node.timestamp = Date.now();
            if (buffer.subarray && (!node.contents || node.contents.subarray)) {
                if (canOwn) {
                    node.contents = buffer.subarray(offset, offset + length);
                    node.usedBytes = length;
                    return length
                } else if (node.usedBytes === 0 && position === 0) {
                    node.contents = buffer.slice(offset, offset + length);
                    node.usedBytes = length;
                    return length
                } else if (position + length <= node.usedBytes) {
                    node.contents.set(buffer.subarray(offset, offset + length), position);
                    return length
                }
            }
            MEMFS.expandFileStorage(node, position + length);
            if (node.contents.subarray && buffer.subarray) {
                node.contents.set(buffer.subarray(offset, offset + length), position)
            } else {
                for (var i = 0; i < length; i++) {
                    node.contents[position + i] = buffer[offset + i]
                }
            }
            node.usedBytes = Math.max(node.usedBytes, position + length);
            return length
        },
        llseek(stream, offset, whence) {
            var position = offset;
            if (whence === 1) {
                position += stream.position
            } else if (whence === 2) {
                if (FS.isFile(stream.node.mode)) {
                    position += stream.node.usedBytes
                }
            }
            if (position < 0) {
                throw new FS.ErrnoError(28)
            }
            return position
        },
        allocate(stream, offset, length) {
            MEMFS.expandFileStorage(stream.node, offset + length);
            stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
        },
        mmap(stream, length, position, prot, flags) {
            if (!FS.isFile(stream.node.mode)) {
                throw new FS.ErrnoError(43)
            }
            var ptr;
            var allocated;
            var contents = stream.node.contents;
            if (!(flags & 2) && contents && contents.buffer === HEAP8.buffer) {
                allocated = false;
                ptr = contents.byteOffset
            } else {
                allocated = true;
                ptr = mmapAlloc(length);
                if (!ptr) {
                    throw new FS.ErrnoError(48)
                }
                if (contents) {
                    if (position > 0 || position + length < contents.length) {
                        if (contents.subarray) {
                            contents = contents.subarray(position, position + length)
                        } else {
                            contents = Array.prototype.slice.call(contents, position, position + length)
                        }
                    }
                    HEAP8.set(contents, ptr)
                }
            }
            return {
                ptr,
                allocated
            }
        },
        msync(stream, buffer, offset, length, mmapFlags) {
            MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
            return 0
        }
    }
};
var asyncLoad = (url,onload,onerror,noRunDep)=>{
    var dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : "";
    readAsync(url).then(arrayBuffer=>{
        onload(new Uint8Array(arrayBuffer));
        if (dep)
            removeRunDependency(dep)
    }
    , err=>{
        if (onerror) {
            onerror()
        } else {
            throw `Loading data file "${url}" failed.`
        }
    }
    );
    if (dep)
        addRunDependency(dep)
}
;
var FS_createDataFile = (parent,name,fileData,canRead,canWrite,canOwn)=>{
    FS.createDataFile(parent, name, fileData, canRead, canWrite, canOwn)
}
;
var preloadPlugins = Module["preloadPlugins"] || [];
var FS_handledByPreloadPlugin = (byteArray,fullname,finish,onerror)=>{
    if (typeof Browser != "undefined")
        Browser.init();
    var handled = false;
    preloadPlugins.forEach(plugin=>{
        if (handled)
            return;
        if (plugin["canHandle"](fullname)) {
            plugin["handle"](byteArray, fullname, finish, onerror);
            handled = true
        }
    }
    );
    return handled
}
;
var FS_createPreloadedFile = (parent,name,url,canRead,canWrite,onload,onerror,dontCreateFile,canOwn,preFinish)=>{
    var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
    var dep = getUniqueRunDependency(`cp ${fullname}`);
    function processData(byteArray) {
        function finish(byteArray) {
            preFinish?.();
            if (!dontCreateFile) {
                FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
            }
            onload?.();
            removeRunDependency(dep)
        }
        if (FS_handledByPreloadPlugin(byteArray, fullname, finish, ()=>{
            onerror?.();
            removeRunDependency(dep)
        }
        )) {
            return
        }
        finish(byteArray)
    }
    addRunDependency(dep);
    if (typeof url == "string") {
        asyncLoad(url, processData, onerror)
    } else {
        processData(url)
    }
}
;
var FS_modeStringToFlags = str=>{
    var flagModes = {
        r: 0,
        "r+": 2,
        w: 512 | 64 | 1,
        "w+": 512 | 64 | 2,
        a: 1024 | 64 | 1,
        "a+": 1024 | 64 | 2
    };
    var flags = flagModes[str];
    if (typeof flags == "undefined") {
        throw new Error(`Unknown file open mode: ${str}`)
    }
    return flags
}
;
var FS_getMode = (canRead,canWrite)=>{
    var mode = 0;
    if (canRead)
        mode |= 292 | 73;
    if (canWrite)
        mode |= 146;
    return mode
}
;
var IDBFS = {
    dbs: {},
    indexedDB: ()=>{
        if (typeof indexedDB != "undefined")
            return indexedDB;
        var ret = null;
        if (typeof window == "object")
            ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        return ret
    }
    ,
    DB_VERSION: 21,
    DB_STORE_NAME: "FILE_DATA",
    queuePersist: mount=>{
        function onPersistComplete() {
            if (mount.idbPersistState === "again")
                startPersist();
            else
                mount.idbPersistState = 0
        }
        function startPersist() {
            mount.idbPersistState = "idb";
            IDBFS.syncfs(mount, false, onPersistComplete)
        }
        if (!mount.idbPersistState) {
            mount.idbPersistState = setTimeout(startPersist, 0)
        } else if (mount.idbPersistState === "idb") {
            mount.idbPersistState = "again"
        }
    }
    ,
    mount: mount=>{
        var mnt = MEMFS.mount(mount);
        if (mount?.opts?.autoPersist) {
            mnt.idbPersistState = 0;
            var memfs_node_ops = mnt.node_ops;
            mnt.node_ops = Object.assign({}, mnt.node_ops);
            mnt.node_ops.mknod = (parent,name,mode,dev)=>{
                var node = memfs_node_ops.mknod(parent, name, mode, dev);
                node.node_ops = mnt.node_ops;
                node.idbfs_mount = mnt.mount;
                node.memfs_stream_ops = node.stream_ops;
                node.stream_ops = Object.assign({}, node.stream_ops);
                node.stream_ops.write = (stream,buffer,offset,length,position,canOwn)=>{
                    stream.node.isModified = true;
                    return node.memfs_stream_ops.write(stream, buffer, offset, length, position, canOwn)
                }
                ;
                node.stream_ops.close = stream=>{
                    var n = stream.node;
                    if (n.isModified) {
                        IDBFS.queuePersist(n.idbfs_mount);
                        n.isModified = false
                    }
                    if (n.memfs_stream_ops.close)
                        return n.memfs_stream_ops.close(stream)
                }
                ;
                return node
            }
            ;
            mnt.node_ops.mkdir = (...args)=>(IDBFS.queuePersist(mnt.mount),
            memfs_node_ops.mkdir(...args));
            mnt.node_ops.rmdir = (...args)=>(IDBFS.queuePersist(mnt.mount),
            memfs_node_ops.rmdir(...args));
            mnt.node_ops.symlink = (...args)=>(IDBFS.queuePersist(mnt.mount),
            memfs_node_ops.symlink(...args));
            mnt.node_ops.unlink = (...args)=>(IDBFS.queuePersist(mnt.mount),
            memfs_node_ops.unlink(...args));
            mnt.node_ops.rename = (...args)=>(IDBFS.queuePersist(mnt.mount),
            memfs_node_ops.rename(...args))
        }
        return mnt
    }
    ,
    syncfs: (mount,populate,callback)=>{
        IDBFS.getLocalSet(mount, (err,local)=>{
            if (err)
                return callback(err);
            IDBFS.getRemoteSet(mount, (err,remote)=>{
                if (err)
                    return callback(err);
                var src = populate ? remote : local;
                var dst = populate ? local : remote;
                IDBFS.reconcile(src, dst, callback)
            }
            )
        }
        )
    }
    ,
    quit: ()=>{
        Object.values(IDBFS.dbs).forEach(value=>value.close());
        IDBFS.dbs = {}
    }
    ,
    getDB: (name,callback)=>{
        var db = IDBFS.dbs[name];
        if (db) {
            return callback(null, db)
        }
        var req;
        try {
            req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION)
        } catch (e) {
            return callback(e)
        }
        if (!req) {
            return callback("Unable to connect to IndexedDB")
        }
        req.onupgradeneeded = e=>{
            var db = e.target.result;
            var transaction = e.target.transaction;
            var fileStore;
            if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
                fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME)
            } else {
                fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME)
            }
            if (!fileStore.indexNames.contains("timestamp")) {
                fileStore.createIndex("timestamp", "timestamp", {
                    unique: false
                })
            }
        }
        ;
        req.onsuccess = ()=>{
            db = req.result;
            IDBFS.dbs[name] = db;
            callback(null, db)
        }
        ;
        req.onerror = e=>{
            callback(e.target.error);
            e.preventDefault()
        }
    }
    ,
    getLocalSet: (mount,callback)=>{
        var entries = {};
        function isRealDir(p) {
            return p !== "." && p !== ".."
        }
        function toAbsolute(root) {
            return p=>PATH.join2(root, p)
        }
        var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
        while (check.length) {
            var path = check.pop();
            var stat;
            try {
                stat = FS.stat(path)
            } catch (e) {
                return callback(e)
            }
            if (FS.isDir(stat.mode)) {
                check.push(...FS.readdir(path).filter(isRealDir).map(toAbsolute(path)))
            }
            entries[path] = {
                timestamp: stat.mtime
            }
        }
        return callback(null, {
            type: "local",
            entries
        })
    }
    ,
    getRemoteSet: (mount,callback)=>{
        var entries = {};
        IDBFS.getDB(mount.mountpoint, (err,db)=>{
            if (err)
                return callback(err);
            try {
                var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readonly");
                transaction.onerror = e=>{
                    callback(e.target.error);
                    e.preventDefault()
                }
                ;
                var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
                var index = store.index("timestamp");
                index.openKeyCursor().onsuccess = event=>{
                    var cursor = event.target.result;
                    if (!cursor) {
                        return callback(null, {
                            type: "remote",
                            db,
                            entries
                        })
                    }
                    entries[cursor.primaryKey] = {
                        timestamp: cursor.key
                    };
                    cursor.continue()
                }
            } catch (e) {
                return callback(e)
            }
        }
        )
    }
    ,
    loadLocalEntry: (path,callback)=>{
        var stat, node;
        try {
            var lookup = FS.lookupPath(path);
            node = lookup.node;
            stat = FS.stat(path)
        } catch (e) {
            return callback(e)
        }
        if (FS.isDir(stat.mode)) {
            return callback(null, {
                timestamp: stat.mtime,
                mode: stat.mode
            })
        } else if (FS.isFile(stat.mode)) {
            node.contents = MEMFS.getFileDataAsTypedArray(node);
            return callback(null, {
                timestamp: stat.mtime,
                mode: stat.mode,
                contents: node.contents
            })
        } else {
            return callback(new Error("node type not supported"))
        }
    }
    ,
    storeLocalEntry: (path,entry,callback)=>{
        try {
            if (FS.isDir(entry["mode"])) {
                FS.mkdirTree(path, entry["mode"])
            } else if (FS.isFile(entry["mode"])) {
                FS.writeFile(path, entry["contents"], {
                    canOwn: true
                })
            } else {
                return callback(new Error("node type not supported"))
            }
            FS.chmod(path, entry["mode"]);
            FS.utime(path, entry["timestamp"], entry["timestamp"])
        } catch (e) {
            return callback(e)
        }
        callback(null)
    }
    ,
    removeLocalEntry: (path,callback)=>{
        try {
            var stat = FS.stat(path);
            if (FS.isDir(stat.mode)) {
                FS.rmdir(path)
            } else if (FS.isFile(stat.mode)) {
                FS.unlink(path)
            }
        } catch (e) {
            return callback(e)
        }
        callback(null)
    }
    ,
    loadRemoteEntry: (store,path,callback)=>{
        var req = store.get(path);
        req.onsuccess = event=>callback(null, event.target.result);
        req.onerror = e=>{
            callback(e.target.error);
            e.preventDefault()
        }
    }
    ,
    storeRemoteEntry: (store,path,entry,callback)=>{
        try {
            var req = store.put(entry, path)
        } catch (e) {
            callback(e);
            return
        }
        req.onsuccess = event=>callback();
        req.onerror = e=>{
            callback(e.target.error);
            e.preventDefault()
        }
    }
    ,
    removeRemoteEntry: (store,path,callback)=>{
        var req = store.delete(path);
        req.onsuccess = event=>callback();
        req.onerror = e=>{
            callback(e.target.error);
            e.preventDefault()
        }
    }
    ,
    reconcile: (src,dst,callback)=>{
        var total = 0;
        var create = [];
        Object.keys(src.entries).forEach(key=>{
            var e = src.entries[key];
            var e2 = dst.entries[key];
            if (!e2 || e["timestamp"].getTime() != e2["timestamp"].getTime()) {
                create.push(key);
                total++
            }
        }
        );
        var remove = [];
        Object.keys(dst.entries).forEach(key=>{
            if (!src.entries[key]) {
                remove.push(key);
                total++
            }
        }
        );
        if (!total) {
            return callback(null)
        }
        var errored = false;
        var db = src.type === "remote" ? src.db : dst.db;
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readwrite");
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
        function done(err) {
            if (err && !errored) {
                errored = true;
                return callback(err)
            }
        }
        transaction.onerror = transaction.onabort = e=>{
            done(e.target.error);
            e.preventDefault()
        }
        ;
        transaction.oncomplete = e=>{
            if (!errored) {
                callback(null)
            }
        }
        ;
        create.sort().forEach(path=>{
            if (dst.type === "local") {
                IDBFS.loadRemoteEntry(store, path, (err,entry)=>{
                    if (err)
                        return done(err);
                    IDBFS.storeLocalEntry(path, entry, done)
                }
                )
            } else {
                IDBFS.loadLocalEntry(path, (err,entry)=>{
                    if (err)
                        return done(err);
                    IDBFS.storeRemoteEntry(store, path, entry, done)
                }
                )
            }
        }
        );
        remove.sort().reverse().forEach(path=>{
            if (dst.type === "local") {
                IDBFS.removeLocalEntry(path, done)
            } else {
                IDBFS.removeRemoteEntry(store, path, done)
            }
        }
        )
    }
};
var FS = {
    root: null,
    mounts: [],
    devices: {},
    streams: [],
    nextInode: 1,
    nameTable: null,
    currentPath: "/",
    initialized: false,
    ignorePermissions: true,
    ErrnoError: class {
        constructor(errno) {
            this.name = "ErrnoError";
            this.errno = errno
        }
    }
    ,
    genericErrors: {},
    filesystems: null,
    syncFSRequests: 0,
    readFiles: {},
    FSStream: class {
        constructor() {
            this.shared = {}
        }
        get object() {
            return this.node
        }
        set object(val) {
            this.node = val
        }
        get isRead() {
            return (this.flags & 2097155) !== 1
        }
        get isWrite() {
            return (this.flags & 2097155) !== 0
        }
        get isAppend() {
            return this.flags & 1024
        }
        get flags() {
            return this.shared.flags
        }
        set flags(val) {
            this.shared.flags = val
        }
        get position() {
            return this.shared.position
        }
        set position(val) {
            this.shared.position = val
        }
    }
    ,
    FSNode: class {
        constructor(parent, name, mode, rdev) {
            if (!parent) {
                parent = this
            }
            this.parent = parent;
            this.mount = parent.mount;
            this.mounted = null;
            this.id = FS.nextInode++;
            this.name = name;
            this.mode = mode;
            this.node_ops = {};
            this.stream_ops = {};
            this.rdev = rdev;
            this.readMode = 292 | 73;
            this.writeMode = 146
        }
        get read() {
            return (this.mode & this.readMode) === this.readMode
        }
        set read(val) {
            val ? this.mode |= this.readMode : this.mode &= ~this.readMode
        }
        get write() {
            return (this.mode & this.writeMode) === this.writeMode
        }
        set write(val) {
            val ? this.mode |= this.writeMode : this.mode &= ~this.writeMode
        }
        get isFolder() {
            return FS.isDir(this.mode)
        }
        get isDevice() {
            return FS.isChrdev(this.mode)
        }
    }
    ,
    lookupPath(path, opts={}) {
        path = PATH_FS.resolve(path);
        if (!path)
            return {
                path: "",
                node: null
            };
        var defaults = {
            follow_mount: true,
            recurse_count: 0
        };
        opts = Object.assign(defaults, opts);
        if (opts.recurse_count > 8) {
            throw new FS.ErrnoError(32)
        }
        var parts = path.split("/").filter(p=>!!p);
        var current = FS.root;
        var current_path = "/";
        for (var i = 0; i < parts.length; i++) {
            var islast = i === parts.length - 1;
            if (islast && opts.parent) {
                break
            }
            current = FS.lookupNode(current, parts[i]);
            current_path = PATH.join2(current_path, parts[i]);
            if (FS.isMountpoint(current)) {
                if (!islast || islast && opts.follow_mount) {
                    current = current.mounted.root
                }
            }
            if (!islast || opts.follow) {
                var count = 0;
                while (FS.isLink(current.mode)) {
                    var link = FS.readlink(current_path);
                    current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
                    var lookup = FS.lookupPath(current_path, {
                        recurse_count: opts.recurse_count + 1
                    });
                    current = lookup.node;
                    if (count++ > 40) {
                        throw new FS.ErrnoError(32)
                    }
                }
            }
        }
        return {
            path: current_path,
            node: current
        }
    },
    getPath(node) {
        var path;
        while (true) {
            if (FS.isRoot(node)) {
                var mount = node.mount.mountpoint;
                if (!path)
                    return mount;
                return mount[mount.length - 1] !== "/" ? `${mount}/${path}` : mount + path
            }
            path = path ? `${node.name}/${path}` : node.name;
            node = node.parent
        }
    },
    hashName(parentid, name) {
        var hash = 0;
        for (var i = 0; i < name.length; i++) {
            hash = (hash << 5) - hash + name.charCodeAt(i) | 0
        }
        return (parentid + hash >>> 0) % FS.nameTable.length
    },
    hashAddNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node
    },
    hashRemoveNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
            FS.nameTable[hash] = node.name_next
        } else {
            var current = FS.nameTable[hash];
            while (current) {
                if (current.name_next === node) {
                    current.name_next = node.name_next;
                    break
                }
                current = current.name_next
            }
        }
    },
    lookupNode(parent, name) {
        var errCode = FS.mayLookup(parent);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
            var nodeName = node.name;
            if (node.parent.id === parent.id && nodeName === name) {
                return node
            }
        }
        return FS.lookup(parent, name)
    },
    createNode(parent, name, mode, rdev) {
        var node = new FS.FSNode(parent,name,mode,rdev);
        FS.hashAddNode(node);
        return node
    },
    destroyNode(node) {
        FS.hashRemoveNode(node)
    },
    isRoot(node) {
        return node === node.parent
    },
    isMountpoint(node) {
        return !!node.mounted
    },
    isFile(mode) {
        return (mode & 61440) === 32768
    },
    isDir(mode) {
        return (mode & 61440) === 16384
    },
    isLink(mode) {
        return (mode & 61440) === 40960
    },
    isChrdev(mode) {
        return (mode & 61440) === 8192
    },
    isBlkdev(mode) {
        return (mode & 61440) === 24576
    },
    isFIFO(mode) {
        return (mode & 61440) === 4096
    },
    isSocket(mode) {
        return (mode & 49152) === 49152
    },
    flagsToPermissionString(flag) {
        var perms = ["r", "w", "rw"][flag & 3];
        if (flag & 512) {
            perms += "w"
        }
        return perms
    },
    nodePermissions(node, perms) {
        if (FS.ignorePermissions) {
            return 0
        }
        if (perms.includes("r") && !(node.mode & 292)) {
            return 2
        } else if (perms.includes("w") && !(node.mode & 146)) {
            return 2
        } else if (perms.includes("x") && !(node.mode & 73)) {
            return 2
        }
        return 0
    },
    mayLookup(dir) {
        if (!FS.isDir(dir.mode))
            return 54;
        var errCode = FS.nodePermissions(dir, "x");
        if (errCode)
            return errCode;
        if (!dir.node_ops.lookup)
            return 2;
        return 0
    },
    mayCreate(dir, name) {
        try {
            var node = FS.lookupNode(dir, name);
            return 20
        } catch (e) {}
        return FS.nodePermissions(dir, "wx")
    },
    mayDelete(dir, name, isdir) {
        var node;
        try {
            node = FS.lookupNode(dir, name)
        } catch (e) {
            return e.errno
        }
        var errCode = FS.nodePermissions(dir, "wx");
        if (errCode) {
            return errCode
        }
        if (isdir) {
            if (!FS.isDir(node.mode)) {
                return 54
            }
            if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
                return 10
            }
        } else {
            if (FS.isDir(node.mode)) {
                return 31
            }
        }
        return 0
    },
    mayOpen(node, flags) {
        if (!node) {
            return 44
        }
        if (FS.isLink(node.mode)) {
            return 32
        } else if (FS.isDir(node.mode)) {
            if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
                return 31
            }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
    },
    MAX_OPEN_FDS: 4096,
    nextfd() {
        for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
            if (!FS.streams[fd]) {
                return fd
            }
        }
        throw new FS.ErrnoError(33)
    },
    getStreamChecked(fd) {
        var stream = FS.getStream(fd);
        if (!stream) {
            throw new FS.ErrnoError(8)
        }
        return stream
    },
    getStream: fd=>FS.streams[fd],
    createStream(stream, fd=-1) {
        stream = Object.assign(new FS.FSStream, stream);
        if (fd == -1) {
            fd = FS.nextfd()
        }
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream
    },
    closeStream(fd) {
        FS.streams[fd] = null
    },
    dupStream(origStream, fd=-1) {
        var stream = FS.createStream(origStream, fd);
        stream.stream_ops?.dup?.(stream);
        return stream
    },
    chrdev_stream_ops: {
        open(stream) {
            var device = FS.getDevice(stream.node.rdev);
            stream.stream_ops = device.stream_ops;
            stream.stream_ops.open?.(stream)
        },
        llseek() {
            throw new FS.ErrnoError(70)
        }
    },
    major: dev=>dev >> 8,
    minor: dev=>dev & 255,
    makedev: (ma,mi)=>ma << 8 | mi,
    registerDevice(dev, ops) {
        FS.devices[dev] = {
            stream_ops: ops
        }
    },
    getDevice: dev=>FS.devices[dev],
    getMounts(mount) {
        var mounts = [];
        var check = [mount];
        while (check.length) {
            var m = check.pop();
            mounts.push(m);
            check.push(...m.mounts)
        }
        return mounts
    },
    syncfs(populate, callback) {
        if (typeof populate == "function") {
            callback = populate;
            populate = false
        }
        FS.syncFSRequests++;
        if (FS.syncFSRequests > 1) {
            err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`)
        }
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
        function doCallback(errCode) {
            FS.syncFSRequests--;
            return callback(errCode)
        }
        function done(errCode) {
            if (errCode) {
                if (!done.errored) {
                    done.errored = true;
                    return doCallback(errCode)
                }
                return
            }
            if (++completed >= mounts.length) {
                doCallback(null)
            }
        }
        mounts.forEach(mount=>{
            if (!mount.type.syncfs) {
                return done(null)
            }
            mount.type.syncfs(mount, populate, done)
        }
        )
    },
    mount(type, opts, mountpoint) {
        var root = mountpoint === "/";
        var pseudo = !mountpoint;
        var node;
        if (root && FS.root) {
            throw new FS.ErrnoError(10)
        } else if (!root && !pseudo) {
            var lookup = FS.lookupPath(mountpoint, {
                follow_mount: false
            });
            mountpoint = lookup.path;
            node = lookup.node;
            if (FS.isMountpoint(node)) {
                throw new FS.ErrnoError(10)
            }
            if (!FS.isDir(node.mode)) {
                throw new FS.ErrnoError(54)
            }
        }
        var mount = {
            type,
            opts,
            mountpoint,
            mounts: []
        };
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
        if (root) {
            FS.root = mountRoot
        } else if (node) {
            node.mounted = mount;
            if (node.mount) {
                node.mount.mounts.push(mount)
            }
        }
        return mountRoot
    },
    unmount(mountpoint) {
        var lookup = FS.lookupPath(mountpoint, {
            follow_mount: false
        });
        if (!FS.isMountpoint(lookup.node)) {
            throw new FS.ErrnoError(28)
        }
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
        Object.keys(FS.nameTable).forEach(hash=>{
            var current = FS.nameTable[hash];
            while (current) {
                var next = current.name_next;
                if (mounts.includes(current.mount)) {
                    FS.destroyNode(current)
                }
                current = next
            }
        }
        );
        node.mounted = null;
        var idx = node.mount.mounts.indexOf(mount);
        node.mount.mounts.splice(idx, 1)
    },
    lookup(parent, name) {
        return parent.node_ops.lookup(parent, name)
    },
    mknod(path, mode, dev) {
        var lookup = FS.lookupPath(path, {
            parent: true
        });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === "." || name === "..") {
            throw new FS.ErrnoError(28)
        }
        var errCode = FS.mayCreate(parent, name);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        if (!parent.node_ops.mknod) {
            throw new FS.ErrnoError(63)
        }
        return parent.node_ops.mknod(parent, name, mode, dev)
    },
    create(path, mode) {
        mode = mode !== undefined ? mode : 438;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0)
    },
    mkdir(path, mode) {
        mode = mode !== undefined ? mode : 511;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0)
    },
    mkdirTree(path, mode) {
        var dirs = path.split("/");
        var d = "";
        for (var i = 0; i < dirs.length; ++i) {
            if (!dirs[i])
                continue;
            d += "/" + dirs[i];
            try {
                FS.mkdir(d, mode)
            } catch (e) {
                if (e.errno != 20)
                    throw e
            }
        }
    },
    mkdev(path, mode, dev) {
        if (typeof dev == "undefined") {
            dev = mode;
            mode = 438
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev)
    },
    symlink(oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
            throw new FS.ErrnoError(44)
        }
        var lookup = FS.lookupPath(newpath, {
            parent: true
        });
        var parent = lookup.node;
        if (!parent) {
            throw new FS.ErrnoError(44)
        }
        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        if (!parent.node_ops.symlink) {
            throw new FS.ErrnoError(63)
        }
        return parent.node_ops.symlink(parent, newname, oldpath)
    },
    rename(old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        var lookup, old_dir, new_dir;
        lookup = FS.lookupPath(old_path, {
            parent: true
        });
        old_dir = lookup.node;
        lookup = FS.lookupPath(new_path, {
            parent: true
        });
        new_dir = lookup.node;
        if (!old_dir || !new_dir)
            throw new FS.ErrnoError(44);
        if (old_dir.mount !== new_dir.mount) {
            throw new FS.ErrnoError(75)
        }
        var old_node = FS.lookupNode(old_dir, old_name);
        var relative = PATH_FS.relative(old_path, new_dirname);
        if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(28)
        }
        relative = PATH_FS.relative(new_path, old_dirname);
        if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(55)
        }
        var new_node;
        try {
            new_node = FS.lookupNode(new_dir, new_name)
        } catch (e) {}
        if (old_node === new_node) {
            return
        }
        var isdir = FS.isDir(old_node.mode);
        var errCode = FS.mayDelete(old_dir, old_name, isdir);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        if (!old_dir.node_ops.rename) {
            throw new FS.ErrnoError(63)
        }
        if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
            throw new FS.ErrnoError(10)
        }
        if (new_dir !== old_dir) {
            errCode = FS.nodePermissions(old_dir, "w");
            if (errCode) {
                throw new FS.ErrnoError(errCode)
            }
        }
        FS.hashRemoveNode(old_node);
        try {
            old_dir.node_ops.rename(old_node, new_dir, new_name);
            old_node.parent = new_dir
        } catch (e) {
            throw e
        } finally {
            FS.hashAddNode(old_node)
        }
    },
    rmdir(path) {
        var lookup = FS.lookupPath(path, {
            parent: true
        });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, true);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        if (!parent.node_ops.rmdir) {
            throw new FS.ErrnoError(63)
        }
        if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10)
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node)
    },
    readdir(path) {
        var lookup = FS.lookupPath(path, {
            follow: true
        });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
            throw new FS.ErrnoError(54)
        }
        return node.node_ops.readdir(node)
    },
    unlink(path) {
        var lookup = FS.lookupPath(path, {
            parent: true
        });
        var parent = lookup.node;
        if (!parent) {
            throw new FS.ErrnoError(44)
        }
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, false);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        if (!parent.node_ops.unlink) {
            throw new FS.ErrnoError(63)
        }
        if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10)
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node)
    },
    readlink(path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
            throw new FS.ErrnoError(44)
        }
        if (!link.node_ops.readlink) {
            throw new FS.ErrnoError(28)
        }
        return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link))
    },
    stat(path, dontFollow) {
        var lookup = FS.lookupPath(path, {
            follow: !dontFollow
        });
        var node = lookup.node;
        if (!node) {
            throw new FS.ErrnoError(44)
        }
        if (!node.node_ops.getattr) {
            throw new FS.ErrnoError(63)
        }
        return node.node_ops.getattr(node)
    },
    lstat(path) {
        return FS.stat(path, true)
    },
    chmod(path, mode, dontFollow) {
        var node;
        if (typeof path == "string") {
            var lookup = FS.lookupPath(path, {
                follow: !dontFollow
            });
            node = lookup.node
        } else {
            node = path
        }
        if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63)
        }
        node.node_ops.setattr(node, {
            mode: mode & 4095 | node.mode & ~4095,
            timestamp: Date.now()
        })
    },
    lchmod(path, mode) {
        FS.chmod(path, mode, true)
    },
    fchmod(fd, mode) {
        var stream = FS.getStreamChecked(fd);
        FS.chmod(stream.node, mode)
    },
    chown(path, uid, gid, dontFollow) {
        var node;
        if (typeof path == "string") {
            var lookup = FS.lookupPath(path, {
                follow: !dontFollow
            });
            node = lookup.node
        } else {
            node = path
        }
        if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63)
        }
        node.node_ops.setattr(node, {
            timestamp: Date.now()
        })
    },
    lchown(path, uid, gid) {
        FS.chown(path, uid, gid, true)
    },
    fchown(fd, uid, gid) {
        var stream = FS.getStreamChecked(fd);
        FS.chown(stream.node, uid, gid)
    },
    truncate(path, len) {
        if (len < 0) {
            throw new FS.ErrnoError(28)
        }
        var node;
        if (typeof path == "string") {
            var lookup = FS.lookupPath(path, {
                follow: true
            });
            node = lookup.node
        } else {
            node = path
        }
        if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63)
        }
        if (FS.isDir(node.mode)) {
            throw new FS.ErrnoError(31)
        }
        if (!FS.isFile(node.mode)) {
            throw new FS.ErrnoError(28)
        }
        var errCode = FS.nodePermissions(node, "w");
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        node.node_ops.setattr(node, {
            size: len,
            timestamp: Date.now()
        })
    },
    ftruncate(fd, len) {
        var stream = FS.getStreamChecked(fd);
        if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(28)
        }
        FS.truncate(stream.node, len)
    },
    utime(path, atime, mtime) {
        var lookup = FS.lookupPath(path, {
            follow: true
        });
        var node = lookup.node;
        node.node_ops.setattr(node, {
            timestamp: Math.max(atime, mtime)
        })
    },
    open(path, flags, mode) {
        if (path === "") {
            throw new FS.ErrnoError(44)
        }
        flags = typeof flags == "string" ? FS_modeStringToFlags(flags) : flags;
        if (flags & 64) {
            mode = typeof mode == "undefined" ? 438 : mode;
            mode = mode & 4095 | 32768
        } else {
            mode = 0
        }
        var node;
        if (typeof path == "object") {
            node = path
        } else {
            path = PATH.normalize(path);
            try {
                var lookup = FS.lookupPath(path, {
                    follow: !(flags & 131072)
                });
                node = lookup.node
            } catch (e) {}
        }
        var created = false;
        if (flags & 64) {
            if (node) {
                if (flags & 128) {
                    throw new FS.ErrnoError(20)
                }
            } else {
                node = FS.mknod(path, mode, 0);
                created = true
            }
        }
        if (!node) {
            throw new FS.ErrnoError(44)
        }
        if (FS.isChrdev(node.mode)) {
            flags &= ~512
        }
        if (flags & 65536 && !FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54)
        }
        if (!created) {
            var errCode = FS.mayOpen(node, flags);
            if (errCode) {
                throw new FS.ErrnoError(errCode)
            }
        }
        if (flags & 512 && !created) {
            FS.truncate(node, 0)
        }
        flags &= ~(128 | 512 | 131072);
        var stream = FS.createStream({
            node,
            path: FS.getPath(node),
            flags,
            seekable: true,
            position: 0,
            stream_ops: node.stream_ops,
            ungotten: [],
            error: false
        });
        if (stream.stream_ops.open) {
            stream.stream_ops.open(stream)
        }
        if (Module["logReadFiles"] && !(flags & 1)) {
            if (!(path in FS.readFiles)) {
                FS.readFiles[path] = 1
            }
        }
        return stream
    },
    close(stream) {
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8)
        }
        if (stream.getdents)
            stream.getdents = null;
        try {
            if (stream.stream_ops.close) {
                stream.stream_ops.close(stream)
            }
        } catch (e) {
            throw e
        } finally {
            FS.closeStream(stream.fd)
        }
        stream.fd = null
    },
    isClosed(stream) {
        return stream.fd === null
    },
    llseek(stream, offset, whence) {
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8)
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
            throw new FS.ErrnoError(70)
        }
        if (whence != 0 && whence != 1 && whence != 2) {
            throw new FS.ErrnoError(28)
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position
    },
    read(stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
            throw new FS.ErrnoError(28)
        }
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8)
        }
        if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(8)
        }
        if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(31)
        }
        if (!stream.stream_ops.read) {
            throw new FS.ErrnoError(28)
        }
        var seeking = typeof position != "undefined";
        if (!seeking) {
            position = stream.position
        } else if (!stream.seekable) {
            throw new FS.ErrnoError(70)
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking)
            stream.position += bytesRead;
        return bytesRead
    },
    write(stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
            throw new FS.ErrnoError(28)
        }
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8)
        }
        if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(8)
        }
        if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(31)
        }
        if (!stream.stream_ops.write) {
            throw new FS.ErrnoError(28)
        }
        if (stream.seekable && stream.flags & 1024) {
            FS.llseek(stream, 0, 2)
        }
        var seeking = typeof position != "undefined";
        if (!seeking) {
            position = stream.position
        } else if (!stream.seekable) {
            throw new FS.ErrnoError(70)
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking)
            stream.position += bytesWritten;
        return bytesWritten
    },
    allocate(stream, offset, length) {
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8)
        }
        if (offset < 0 || length <= 0) {
            throw new FS.ErrnoError(28)
        }
        if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(8)
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(43)
        }
        if (!stream.stream_ops.allocate) {
            throw new FS.ErrnoError(138)
        }
        stream.stream_ops.allocate(stream, offset, length)
    },
    mmap(stream, length, position, prot, flags) {
        if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
            throw new FS.ErrnoError(2)
        }
        if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(2)
        }
        if (!stream.stream_ops.mmap) {
            throw new FS.ErrnoError(43)
        }
        if (!length) {
            throw new FS.ErrnoError(28)
        }
        return stream.stream_ops.mmap(stream, length, position, prot, flags)
    },
    msync(stream, buffer, offset, length, mmapFlags) {
        if (!stream.stream_ops.msync) {
            return 0
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
    },
    ioctl(stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
            throw new FS.ErrnoError(59)
        }
        return stream.stream_ops.ioctl(stream, cmd, arg)
    },
    readFile(path, opts={}) {
        opts.flags = opts.flags || 0;
        opts.encoding = opts.encoding || "binary";
        if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
            throw new Error(`Invalid encoding type "${opts.encoding}"`)
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === "utf8") {
            ret = UTF8ArrayToString(buf, 0)
        } else if (opts.encoding === "binary") {
            ret = buf
        }
        FS.close(stream);
        return ret
    },
    writeFile(path, data, opts={}) {
        opts.flags = opts.flags || 577;
        var stream = FS.open(path, opts.flags, opts.mode);
        if (typeof data == "string") {
            var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
            var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
            FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn)
        } else if (ArrayBuffer.isView(data)) {
            FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn)
        } else {
            throw new Error("Unsupported data type")
        }
        FS.close(stream)
    },
    cwd: ()=>FS.currentPath,
    chdir(path) {
        var lookup = FS.lookupPath(path, {
            follow: true
        });
        if (lookup.node === null) {
            throw new FS.ErrnoError(44)
        }
        if (!FS.isDir(lookup.node.mode)) {
            throw new FS.ErrnoError(54)
        }
        var errCode = FS.nodePermissions(lookup.node, "x");
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        FS.currentPath = lookup.path
    },
    createDefaultDirectories() {
        FS.mkdir("/tmp");
        FS.mkdir("/home");
        FS.mkdir("/home/web_user")
    },
    createDefaultDevices() {
        FS.mkdir("/dev");
        FS.registerDevice(FS.makedev(1, 3), {
            read: ()=>0,
            write: (stream,buffer,offset,length,pos)=>length
        });
        FS.mkdev("/dev/null", FS.makedev(1, 3));
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev("/dev/tty", FS.makedev(5, 0));
        FS.mkdev("/dev/tty1", FS.makedev(6, 0));
        var randomBuffer = new Uint8Array(1024)
          , randomLeft = 0;
        var randomByte = ()=>{
            if (randomLeft === 0) {
                randomLeft = randomFill(randomBuffer).byteLength
            }
            return randomBuffer[--randomLeft]
        }
        ;
        FS.createDevice("/dev", "random", randomByte);
        FS.createDevice("/dev", "urandom", randomByte);
        FS.mkdir("/dev/shm");
        FS.mkdir("/dev/shm/tmp")
    },
    createSpecialDirectories() {
        FS.mkdir("/proc");
        var proc_self = FS.mkdir("/proc/self");
        FS.mkdir("/proc/self/fd");
        FS.mount({
            mount() {
                var node = FS.createNode(proc_self, "fd", 16384 | 511, 73);
                node.node_ops = {
                    lookup(parent, name) {
                        var fd = +name;
                        var stream = FS.getStreamChecked(fd);
                        var ret = {
                            parent: null,
                            mount: {
                                mountpoint: "fake"
                            },
                            node_ops: {
                                readlink: ()=>stream.path
                            }
                        };
                        ret.parent = ret;
                        return ret
                    }
                };
                return node
            }
        }, {}, "/proc/self/fd")
    },
    createStandardStreams(input, output, error) {
        if (input) {
            FS.createDevice("/dev", "stdin", input)
        } else {
            FS.symlink("/dev/tty", "/dev/stdin")
        }
        if (output) {
            FS.createDevice("/dev", "stdout", null, output)
        } else {
            FS.symlink("/dev/tty", "/dev/stdout")
        }
        if (error) {
            FS.createDevice("/dev", "stderr", null, error)
        } else {
            FS.symlink("/dev/tty1", "/dev/stderr")
        }
        var stdin = FS.open("/dev/stdin", 0);
        var stdout = FS.open("/dev/stdout", 1);
        var stderr = FS.open("/dev/stderr", 1)
    },
    staticInit() {
        [44].forEach(code=>{
            FS.genericErrors[code] = new FS.ErrnoError(code);
            FS.genericErrors[code].stack = "<generic error, no stack>"
        }
        );
        FS.nameTable = new Array(4096);
        FS.mount(MEMFS, {}, "/");
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
        FS.filesystems = {
            MEMFS,
            IDBFS
        }
    },
    init(input, output, error) {
        FS.initialized = true;
        input ??= Module["stdin"];
        output ??= Module["stdout"];
        error ??= Module["stderr"];
        FS.createStandardStreams(input, output, error)
    },
    quit() {
        FS.initialized = false;
        for (var i = 0; i < FS.streams.length; i++) {
            var stream = FS.streams[i];
            if (!stream) {
                continue
            }
            FS.close(stream)
        }
    },
    findObject(path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (!ret.exists) {
            return null
        }
        return ret.object
    },
    analyzePath(path, dontResolveLastLink) {
        try {
            var lookup = FS.lookupPath(path, {
                follow: !dontResolveLastLink
            });
            path = lookup.path
        } catch (e) {}
        var ret = {
            isRoot: false,
            exists: false,
            error: 0,
            name: null,
            path: null,
            object: null,
            parentExists: false,
            parentPath: null,
            parentObject: null
        };
        try {
            var lookup = FS.lookupPath(path, {
                parent: true
            });
            ret.parentExists = true;
            ret.parentPath = lookup.path;
            ret.parentObject = lookup.node;
            ret.name = PATH.basename(path);
            lookup = FS.lookupPath(path, {
                follow: !dontResolveLastLink
            });
            ret.exists = true;
            ret.path = lookup.path;
            ret.object = lookup.node;
            ret.name = lookup.node.name;
            ret.isRoot = lookup.path === "/"
        } catch (e) {
            ret.error = e.errno
        }
        return ret
    },
    createPath(parent, path, canRead, canWrite) {
        parent = typeof parent == "string" ? parent : FS.getPath(parent);
        var parts = path.split("/").reverse();
        while (parts.length) {
            var part = parts.pop();
            if (!part)
                continue;
            var current = PATH.join2(parent, part);
            try {
                FS.mkdir(current)
            } catch (e) {}
            parent = current
        }
        return current
    },
    createFile(parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(canRead, canWrite);
        return FS.create(path, mode)
    },
    createDataFile(parent, name, data, canRead, canWrite, canOwn) {
        var path = name;
        if (parent) {
            parent = typeof parent == "string" ? parent : FS.getPath(parent);
            path = name ? PATH.join2(parent, name) : parent
        }
        var mode = FS_getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
            if (typeof data == "string") {
                var arr = new Array(data.length);
                for (var i = 0, len = data.length; i < len; ++i)
                    arr[i] = data.charCodeAt(i);
                data = arr
            }
            FS.chmod(node, mode | 146);
            var stream = FS.open(node, 577);
            FS.write(stream, data, 0, data.length, 0, canOwn);
            FS.close(stream);
            FS.chmod(node, mode)
        }
    },
    createDevice(parent, name, input, output) {
        var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(!!input, !!output);
        FS.createDevice.major ??= 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        FS.registerDevice(dev, {
            open(stream) {
                stream.seekable = false
            },
            close(stream) {
                if (output?.buffer?.length) {
                    output(10)
                }
            },
            read(stream, buffer, offset, length, pos) {
                var bytesRead = 0;
                for (var i = 0; i < length; i++) {
                    var result;
                    try {
                        result = input()
                    } catch (e) {
                        throw new FS.ErrnoError(29)
                    }
                    if (result === undefined && bytesRead === 0) {
                        throw new FS.ErrnoError(6)
                    }
                    if (result === null || result === undefined)
                        break;
                    bytesRead++;
                    buffer[offset + i] = result
                }
                if (bytesRead) {
                    stream.node.timestamp = Date.now()
                }
                return bytesRead
            },
            write(stream, buffer, offset, length, pos) {
                for (var i = 0; i < length; i++) {
                    try {
                        output(buffer[offset + i])
                    } catch (e) {
                        throw new FS.ErrnoError(29)
                    }
                }
                if (length) {
                    stream.node.timestamp = Date.now()
                }
                return i
            }
        });
        return FS.mkdev(path, mode, dev)
    },
    forceLoadFile(obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
            return true;
        if (typeof XMLHttpRequest != "undefined") {
            throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")
        } else {
            try {
                obj.contents = readBinary(obj.url);
                obj.usedBytes = obj.contents.length
            } catch (e) {
                throw new FS.ErrnoError(29)
            }
        }
    },
    createLazyFile(parent, name, url, canRead, canWrite) {
        class LazyUint8Array {
            constructor() {
                this.lengthKnown = false;
                this.chunks = []
            }
            get(idx) {
                if (idx > this.length - 1 || idx < 0) {
                    return undefined
                }
                var chunkOffset = idx % this.chunkSize;
                var chunkNum = idx / this.chunkSize | 0;
                return this.getter(chunkNum)[chunkOffset]
            }
            setDataGetter(getter) {
                this.getter = getter
            }
            cacheLength() {
                var xhr = new XMLHttpRequest;
                xhr.open("HEAD", url, false);
                xhr.send(null);
                if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
                    throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
                var datalength = Number(xhr.getResponseHeader("Content-length"));
                var header;
                var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
                var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
                var chunkSize = 1024 * 1024;
                if (!hasByteServing)
                    chunkSize = datalength;
                var doXHR = (from,to)=>{
                    if (from > to)
                        throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
                    if (to > datalength - 1)
                        throw new Error("only " + datalength + " bytes available! programmer error!");
                    var xhr = new XMLHttpRequest;
                    xhr.open("GET", url, false);
                    if (datalength !== chunkSize)
                        xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
                    xhr.responseType = "arraybuffer";
                    if (xhr.overrideMimeType) {
                        xhr.overrideMimeType("text/plain; charset=x-user-defined")
                    }
                    xhr.send(null);
                    if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
                        throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
                    if (xhr.response !== undefined) {
                        return new Uint8Array(xhr.response || [])
                    }
                    return intArrayFromString(xhr.responseText || "", true)
                }
                ;
                var lazyArray = this;
                lazyArray.setDataGetter(chunkNum=>{
                    var start = chunkNum * chunkSize;
                    var end = (chunkNum + 1) * chunkSize - 1;
                    end = Math.min(end, datalength - 1);
                    if (typeof lazyArray.chunks[chunkNum] == "undefined") {
                        lazyArray.chunks[chunkNum] = doXHR(start, end)
                    }
                    if (typeof lazyArray.chunks[chunkNum] == "undefined")
                        throw new Error("doXHR failed!");
                    return lazyArray.chunks[chunkNum]
                }
                );
                if (usesGzip || !datalength) {
                    chunkSize = datalength = 1;
                    datalength = this.getter(0).length;
                    chunkSize = datalength;
                    out("LazyFiles on gzip forces download of the whole file when length is accessed")
                }
                this._length = datalength;
                this._chunkSize = chunkSize;
                this.lengthKnown = true
            }
            get length() {
                if (!this.lengthKnown) {
                    this.cacheLength()
                }
                return this._length
            }
            get chunkSize() {
                if (!this.lengthKnown) {
                    this.cacheLength()
                }
                return this._chunkSize
            }
        }
        if (typeof XMLHttpRequest != "undefined") {
            if (!ENVIRONMENT_IS_WORKER)
                throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
            var lazyArray = new LazyUint8Array;
            var properties = {
                isDevice: false,
                contents: lazyArray
            }
        } else {
            var properties = {
                isDevice: false,
                url
            }
        }
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        if (properties.contents) {
            node.contents = properties.contents
        } else if (properties.url) {
            node.contents = null;
            node.url = properties.url
        }
        Object.defineProperties(node, {
            usedBytes: {
                get: function() {
                    return this.contents.length
                }
            }
        });
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(key=>{
            var fn = node.stream_ops[key];
            stream_ops[key] = (...args)=>{
                FS.forceLoadFile(node);
                return fn(...args)
            }
        }
        );
        function writeChunks(stream, buffer, offset, length, position) {
            var contents = stream.node.contents;
            if (position >= contents.length)
                return 0;
            var size = Math.min(contents.length - position, length);
            if (contents.slice) {
                for (var i = 0; i < size; i++) {
                    buffer[offset + i] = contents[position + i]
                }
            } else {
                for (var i = 0; i < size; i++) {
                    buffer[offset + i] = contents.get(position + i)
                }
            }
            return size
        }
        stream_ops.read = (stream,buffer,offset,length,position)=>{
            FS.forceLoadFile(node);
            return writeChunks(stream, buffer, offset, length, position)
        }
        ;
        stream_ops.mmap = (stream,length,position,prot,flags)=>{
            FS.forceLoadFile(node);
            var ptr = mmapAlloc(length);
            if (!ptr) {
                throw new FS.ErrnoError(48)
            }
            writeChunks(stream, HEAP8, ptr, length, position);
            return {
                ptr,
                allocated: true
            }
        }
        ;
        node.stream_ops = stream_ops;
        return node
    }
};
var SYSCALLS = {
    DEFAULT_POLLMASK: 5,
    calculateAt(dirfd, path, allowEmpty) {
        if (PATH.isAbs(path)) {
            return path
        }
        var dir;
        if (dirfd === -100) {
            dir = FS.cwd()
        } else {
            var dirstream = SYSCALLS.getStreamFromFD(dirfd);
            dir = dirstream.path
        }
        if (path.length == 0) {
            if (!allowEmpty) {
                throw new FS.ErrnoError(44)
            }
            return dir
        }
        return PATH.join2(dir, path)
    },
    doStat(func, path, buf) {
        var stat = func(path);
        HEAP32[buf >> 2] = stat.dev;
        HEAP32[buf + 4 >> 2] = stat.mode;
        HEAPU32[buf + 8 >> 2] = stat.nlink;
        HEAP32[buf + 12 >> 2] = stat.uid;
        HEAP32[buf + 16 >> 2] = stat.gid;
        HEAP32[buf + 20 >> 2] = stat.rdev;
        tempI64 = [stat.size >>> 0, (tempDouble = stat.size,
        +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
        HEAP32[buf + 24 >> 2] = tempI64[0],
        HEAP32[buf + 28 >> 2] = tempI64[1];
        HEAP32[buf + 32 >> 2] = 4096;
        HEAP32[buf + 36 >> 2] = stat.blocks;
        var atime = stat.atime.getTime();
        var mtime = stat.mtime.getTime();
        var ctime = stat.ctime.getTime();
        tempI64 = [Math.floor(atime / 1e3) >>> 0, (tempDouble = Math.floor(atime / 1e3),
        +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
        HEAP32[buf + 40 >> 2] = tempI64[0],
        HEAP32[buf + 44 >> 2] = tempI64[1];
        HEAPU32[buf + 48 >> 2] = atime % 1e3 * 1e3 * 1e3;
        tempI64 = [Math.floor(mtime / 1e3) >>> 0, (tempDouble = Math.floor(mtime / 1e3),
        +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
        HEAP32[buf + 56 >> 2] = tempI64[0],
        HEAP32[buf + 60 >> 2] = tempI64[1];
        HEAPU32[buf + 64 >> 2] = mtime % 1e3 * 1e3 * 1e3;
        tempI64 = [Math.floor(ctime / 1e3) >>> 0, (tempDouble = Math.floor(ctime / 1e3),
        +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
        HEAP32[buf + 72 >> 2] = tempI64[0],
        HEAP32[buf + 76 >> 2] = tempI64[1];
        HEAPU32[buf + 80 >> 2] = ctime % 1e3 * 1e3 * 1e3;
        tempI64 = [stat.ino >>> 0, (tempDouble = stat.ino,
        +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
        HEAP32[buf + 88 >> 2] = tempI64[0],
        HEAP32[buf + 92 >> 2] = tempI64[1];
        return 0
    },
    doMsync(addr, stream, len, flags, offset) {
        if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43)
        }
        if (flags & 2) {
            return 0
        }
        var buffer = HEAPU8.slice(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags)
    },
    getStreamFromFD(fd) {
        var stream = FS.getStreamChecked(fd);
        return stream
    },
    varargs: undefined,
    getStr(ptr) {
        var ret = UTF8ToString(ptr);
        return ret
    }
};
function ___syscall_faccessat(dirfd, path, amode, flags) {
    try {
        path = SYSCALLS.getStr(path);
        path = SYSCALLS.calculateAt(dirfd, path);
        if (amode & ~7) {
            return -28
        }
        var lookup = FS.lookupPath(path, {
            follow: true
        });
        var node = lookup.node;
        if (!node) {
            return -44
        }
        var perms = "";
        if (amode & 4)
            perms += "r";
        if (amode & 2)
            perms += "w";
        if (amode & 1)
            perms += "x";
        if (perms && FS.nodePermissions(node, perms)) {
            return -2
        }
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return -e.errno
    }
}
function syscallGetVarargI() {
    var ret = HEAP32[+SYSCALLS.varargs >> 2];
    SYSCALLS.varargs += 4;
    return ret
}
var syscallGetVarargP = syscallGetVarargI;
function ___syscall_fcntl64(fd, cmd, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        switch (cmd) {
        case 0:
            {
                var arg = syscallGetVarargI();
                if (arg < 0) {
                    return -28
                }
                while (FS.streams[arg]) {
                    arg++
                }
                var newStream;
                newStream = FS.dupStream(stream, arg);
                return newStream.fd
            }
        case 1:
        case 2:
            return 0;
        case 3:
            return stream.flags;
        case 4:
            {
                var arg = syscallGetVarargI();
                stream.flags |= arg;
                return 0
            }
        case 12:
            {
                var arg = syscallGetVarargP();
                var offset = 0;
                HEAP16[arg + offset >> 1] = 2;
                return 0
            }
        case 13:
        case 14:
            return 0
        }
        return -28
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return -e.errno
    }
}
var stringToUTF8 = (str,outPtr,maxBytesToWrite)=>stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
function ___syscall_getdents64(fd, dirp, count) {
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        stream.getdents ||= FS.readdir(stream.path);
        var struct_size = 280;
        var pos = 0;
        var off = FS.llseek(stream, 0, 1);
        var idx = Math.floor(off / struct_size);
        while (idx < stream.getdents.length && pos + struct_size <= count) {
            var id;
            var type;
            var name = stream.getdents[idx];
            if (name === ".") {
                id = stream.node.id;
                type = 4
            } else if (name === "..") {
                var lookup = FS.lookupPath(stream.path, {
                    parent: true
                });
                id = lookup.node.id;
                type = 4
            } else {
                var child = FS.lookupNode(stream.node, name);
                id = child.id;
                type = FS.isChrdev(child.mode) ? 2 : FS.isDir(child.mode) ? 4 : FS.isLink(child.mode) ? 10 : 8
            }
            tempI64 = [id >>> 0, (tempDouble = id,
            +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
            HEAP32[dirp + pos >> 2] = tempI64[0],
            HEAP32[dirp + pos + 4 >> 2] = tempI64[1];
            tempI64 = [(idx + 1) * struct_size >>> 0, (tempDouble = (idx + 1) * struct_size,
            +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
            HEAP32[dirp + pos + 8 >> 2] = tempI64[0],
            HEAP32[dirp + pos + 12 >> 2] = tempI64[1];
            HEAP16[dirp + pos + 16 >> 1] = 280;
            HEAP8[dirp + pos + 18] = type;
            stringToUTF8(name, dirp + pos + 19, 256);
            pos += struct_size;
            idx += 1
        }
        FS.llseek(stream, idx * struct_size, 0);
        return pos
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return -e.errno
    }
}
function ___syscall_ioctl(fd, op, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        switch (op) {
        case 21509:
            {
                if (!stream.tty)
                    return -59;
                return 0
            }
        case 21505:
            {
                if (!stream.tty)
                    return -59;
                if (stream.tty.ops.ioctl_tcgets) {
                    var termios = stream.tty.ops.ioctl_tcgets(stream);
                    var argp = syscallGetVarargP();
                    HEAP32[argp >> 2] = termios.c_iflag || 0;
                    HEAP32[argp + 4 >> 2] = termios.c_oflag || 0;
                    HEAP32[argp + 8 >> 2] = termios.c_cflag || 0;
                    HEAP32[argp + 12 >> 2] = termios.c_lflag || 0;
                    for (var i = 0; i < 32; i++) {
                        HEAP8[argp + i + 17] = termios.c_cc[i] || 0
                    }
                    return 0
                }
                return 0
            }
        case 21510:
        case 21511:
        case 21512:
            {
                if (!stream.tty)
                    return -59;
                return 0
            }
        case 21506:
        case 21507:
        case 21508:
            {
                if (!stream.tty)
                    return -59;
                if (stream.tty.ops.ioctl_tcsets) {
                    var argp = syscallGetVarargP();
                    var c_iflag = HEAP32[argp >> 2];
                    var c_oflag = HEAP32[argp + 4 >> 2];
                    var c_cflag = HEAP32[argp + 8 >> 2];
                    var c_lflag = HEAP32[argp + 12 >> 2];
                    var c_cc = [];
                    for (var i = 0; i < 32; i++) {
                        c_cc.push(HEAP8[argp + i + 17])
                    }
                    return stream.tty.ops.ioctl_tcsets(stream.tty, op, {
                        c_iflag,
                        c_oflag,
                        c_cflag,
                        c_lflag,
                        c_cc
                    })
                }
                return 0
            }
        case 21519:
            {
                if (!stream.tty)
                    return -59;
                var argp = syscallGetVarargP();
                HEAP32[argp >> 2] = 0;
                return 0
            }
        case 21520:
            {
                if (!stream.tty)
                    return -59;
                return -28
            }
        case 21531:
            {
                var argp = syscallGetVarargP();
                return FS.ioctl(stream, op, argp)
            }
        case 21523:
            {
                if (!stream.tty)
                    return -59;
                if (stream.tty.ops.ioctl_tiocgwinsz) {
                    var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
                    var argp = syscallGetVarargP();
                    HEAP16[argp >> 1] = winsize[0];
                    HEAP16[argp + 2 >> 1] = winsize[1]
                }
                return 0
            }
        case 21524:
            {
                if (!stream.tty)
                    return -59;
                return 0
            }
        case 21515:
            {
                if (!stream.tty)
                    return -59;
                return 0
            }
        default:
            return -28
        }
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return -e.errno
    }
}
function ___syscall_mkdirat(dirfd, path, mode) {
    try {
        path = SYSCALLS.getStr(path);
        path = SYSCALLS.calculateAt(dirfd, path);
        path = PATH.normalize(path);
        if (path[path.length - 1] === "/")
            path = path.substr(0, path.length - 1);
        FS.mkdir(path, mode, 0);
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return -e.errno
    }
}
function ___syscall_openat(dirfd, path, flags, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        path = SYSCALLS.getStr(path);
        path = SYSCALLS.calculateAt(dirfd, path);
        var mode = varargs ? syscallGetVarargI() : 0;
        return FS.open(path, flags, mode).fd
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return -e.errno
    }
}
function ___syscall_renameat(olddirfd, oldpath, newdirfd, newpath) {
    try {
        oldpath = SYSCALLS.getStr(oldpath);
        newpath = SYSCALLS.getStr(newpath);
        oldpath = SYSCALLS.calculateAt(olddirfd, oldpath);
        newpath = SYSCALLS.calculateAt(newdirfd, newpath);
        FS.rename(oldpath, newpath);
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return -e.errno
    }
}
function ___syscall_rmdir(path) {
    try {
        path = SYSCALLS.getStr(path);
        FS.rmdir(path);
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return -e.errno
    }
}
function ___syscall_stat64(path, buf) {
    try {
        path = SYSCALLS.getStr(path);
        return SYSCALLS.doStat(FS.stat, path, buf)
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return -e.errno
    }
}
function ___syscall_unlinkat(dirfd, path, flags) {
    try {
        path = SYSCALLS.getStr(path);
        path = SYSCALLS.calculateAt(dirfd, path);
        if (flags === 0) {
            FS.unlink(path)
        } else if (flags === 512) {
            FS.rmdir(path)
        } else {
            abort("Invalid flags passed to unlinkat")
        }
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return -e.errno
    }
}
var readI53FromI64 = ptr=>HEAPU32[ptr >> 2] + HEAP32[ptr + 4 >> 2] * 4294967296;
function ___syscall_utimensat(dirfd, path, times, flags) {
    try {
        path = SYSCALLS.getStr(path);
        path = SYSCALLS.calculateAt(dirfd, path, true);
        var now = Date.now(), atime, mtime;
        if (!times) {
            atime = now;
            mtime = now
        } else {
            var seconds = readI53FromI64(times);
            var nanoseconds = HEAP32[times + 8 >> 2];
            if (nanoseconds == 1073741823) {
                atime = now
            } else if (nanoseconds == 1073741822) {
                atime = -1
            } else {
                atime = seconds * 1e3 + nanoseconds / (1e3 * 1e3)
            }
            times += 16;
            seconds = readI53FromI64(times);
            nanoseconds = HEAP32[times + 8 >> 2];
            if (nanoseconds == 1073741823) {
                mtime = now
            } else if (nanoseconds == 1073741822) {
                mtime = -1
            } else {
                mtime = seconds * 1e3 + nanoseconds / (1e3 * 1e3)
            }
        }
        if (mtime != -1 || atime != -1) {
            FS.utime(path, atime, mtime)
        }
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return -e.errno
    }
}
var __abort_js = ()=>{
    abort("")
}
;
var __emscripten_memcpy_js = (dest,src,num)=>HEAPU8.copyWithin(dest, src, src + num);
var isLeapYear = year=>year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
var MONTH_DAYS_LEAP_CUMULATIVE = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
var MONTH_DAYS_REGULAR_CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
var ydayFromDate = date=>{
    var leap = isLeapYear(date.getFullYear());
    var monthDaysCumulative = leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE;
    var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1;
    return yday
}
;
var convertI32PairToI53Checked = (lo,hi)=>hi + 2097152 >>> 0 < 4194305 - !!lo ? (lo >>> 0) + hi * 4294967296 : NaN;
function __localtime_js(time_low, time_high, tmPtr) {
    var time = convertI32PairToI53Checked(time_low, time_high);
    var date = new Date(time * 1e3);
    HEAP32[tmPtr >> 2] = date.getSeconds();
    HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
    HEAP32[tmPtr + 8 >> 2] = date.getHours();
    HEAP32[tmPtr + 12 >> 2] = date.getDate();
    HEAP32[tmPtr + 16 >> 2] = date.getMonth();
    HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
    HEAP32[tmPtr + 24 >> 2] = date.getDay();
    var yday = ydayFromDate(date) | 0;
    HEAP32[tmPtr + 28 >> 2] = yday;
    HEAP32[tmPtr + 36 >> 2] = -(date.getTimezoneOffset() * 60);
    var start = new Date(date.getFullYear(),0,1);
    var summerOffset = new Date(date.getFullYear(),6,1).getTimezoneOffset();
    var winterOffset = start.getTimezoneOffset();
    var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
    HEAP32[tmPtr + 32 >> 2] = dst
}
var setTempRet0 = val=>__emscripten_tempret_set(val);
var __mktime_js = function(tmPtr) {
    var ret = (()=>{
        var date = new Date(HEAP32[tmPtr + 20 >> 2] + 1900,HEAP32[tmPtr + 16 >> 2],HEAP32[tmPtr + 12 >> 2],HEAP32[tmPtr + 8 >> 2],HEAP32[tmPtr + 4 >> 2],HEAP32[tmPtr >> 2],0);
        var dst = HEAP32[tmPtr + 32 >> 2];
        var guessedOffset = date.getTimezoneOffset();
        var start = new Date(date.getFullYear(),0,1);
        var summerOffset = new Date(date.getFullYear(),6,1).getTimezoneOffset();
        var winterOffset = start.getTimezoneOffset();
        var dstOffset = Math.min(winterOffset, summerOffset);
        if (dst < 0) {
            HEAP32[tmPtr + 32 >> 2] = Number(summerOffset != winterOffset && dstOffset == guessedOffset)
        } else if (dst > 0 != (dstOffset == guessedOffset)) {
            var nonDstOffset = Math.max(winterOffset, summerOffset);
            var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
            date.setTime(date.getTime() + (trueOffset - guessedOffset) * 6e4)
        }
        HEAP32[tmPtr + 24 >> 2] = date.getDay();
        var yday = ydayFromDate(date) | 0;
        HEAP32[tmPtr + 28 >> 2] = yday;
        HEAP32[tmPtr >> 2] = date.getSeconds();
        HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
        HEAP32[tmPtr + 8 >> 2] = date.getHours();
        HEAP32[tmPtr + 12 >> 2] = date.getDate();
        HEAP32[tmPtr + 16 >> 2] = date.getMonth();
        HEAP32[tmPtr + 20 >> 2] = date.getYear();
        var timeMs = date.getTime();
        if (isNaN(timeMs)) {
            return -1
        }
        return timeMs / 1e3
    }
    )();
    return setTempRet0((tempDouble = ret,
    +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)),
    ret >>> 0
};
var __tzset_js = (timezone,daylight,std_name,dst_name)=>{
    var currentYear = (new Date).getFullYear();
    var winter = new Date(currentYear,0,1);
    var summer = new Date(currentYear,6,1);
    var winterOffset = winter.getTimezoneOffset();
    var summerOffset = summer.getTimezoneOffset();
    var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
    HEAPU32[timezone >> 2] = stdTimezoneOffset * 60;
    HEAP32[daylight >> 2] = Number(winterOffset != summerOffset);
    var extractZone = timezoneOffset=>{
        var sign = timezoneOffset >= 0 ? "-" : "+";
        var absOffset = Math.abs(timezoneOffset);
        var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
        var minutes = String(absOffset % 60).padStart(2, "0");
        return `UTC${sign}${hours}${minutes}`
    }
    ;
    var winterName = extractZone(winterOffset);
    var summerName = extractZone(summerOffset);
    if (summerOffset < winterOffset) {
        stringToUTF8(winterName, std_name, 17);
        stringToUTF8(summerName, dst_name, 17)
    } else {
        stringToUTF8(winterName, dst_name, 17);
        stringToUTF8(summerName, std_name, 17)
    }
}
;
var readEmAsmArgsArray = [];
var readEmAsmArgs = (sigPtr,buf)=>{
    readEmAsmArgsArray.length = 0;
    var ch;
    while (ch = HEAPU8[sigPtr++]) {
        var wide = ch != 105;
        wide &= ch != 112;
        buf += wide && buf % 8 ? 4 : 0;
        readEmAsmArgsArray.push(ch == 112 ? HEAPU32[buf >> 2] : ch == 105 ? HEAP32[buf >> 2] : HEAPF64[buf >> 3]);
        buf += wide ? 8 : 4
    }
    return readEmAsmArgsArray
}
;
var runEmAsmFunction = (code,sigPtr,argbuf)=>{
    var args = readEmAsmArgs(sigPtr, argbuf);
    return ASM_CONSTS[code](...args)
}
;
var _emscripten_asm_const_int = (code,sigPtr,argbuf)=>runEmAsmFunction(code, sigPtr, argbuf);
var _emscripten_set_main_loop_timing = (mode,value)=>{
    MainLoop.timingMode = mode;
    MainLoop.timingValue = value;
    if (!MainLoop.func) {
        return 1
    }
    if (!MainLoop.running) {
        MainLoop.running = true
    }
    if (mode == 0) {
        MainLoop.scheduler = function MainLoop_scheduler_setTimeout() {
            var timeUntilNextTick = Math.max(0, MainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
            setTimeout(MainLoop.runner, timeUntilNextTick)
        }
        ;
        MainLoop.method = "timeout"
    } else if (mode == 1) {
        MainLoop.scheduler = function MainLoop_scheduler_rAF() {
            MainLoop.requestAnimationFrame(MainLoop.runner)
        }
        ;
        MainLoop.method = "rAF"
    } else if (mode == 2) {
        if (typeof MainLoop.setImmediate == "undefined") {
            if (typeof setImmediate == "undefined") {
                var setImmediates = [];
                var emscriptenMainLoopMessageId = "setimmediate";
                var MainLoop_setImmediate_messageHandler = event=>{
                    if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
                        event.stopPropagation();
                        setImmediates.shift()()
                    }
                }
                ;
                addEventListener("message", MainLoop_setImmediate_messageHandler, true);
                MainLoop.setImmediate = func=>{
                    setImmediates.push(func);
                    if (ENVIRONMENT_IS_WORKER) {
                        Module["setImmediates"] ??= [];
                        Module["setImmediates"].push(func);
                        postMessage({
                            target: emscriptenMainLoopMessageId
                        })
                    } else
                        postMessage(emscriptenMainLoopMessageId, "*")
                }
            } else {
                MainLoop.setImmediate = setImmediate
            }
        }
        MainLoop.scheduler = function MainLoop_scheduler_setImmediate() {
            MainLoop.setImmediate(MainLoop.runner)
        }
        ;
        MainLoop.method = "immediate"
    }
    return 0
}
;
var _emscripten_get_now = ()=>performance.now();
var runtimeKeepaliveCounter = 0;
var keepRuntimeAlive = ()=>noExitRuntime || runtimeKeepaliveCounter > 0;
var _proc_exit = code=>{
    EXITSTATUS = code;
    if (!keepRuntimeAlive()) {
        Module["onExit"]?.(code);
        ABORT = true
    }
    quit_(code, new ExitStatus(code))
}
;
var exitJS = (status,implicit)=>{
    EXITSTATUS = status;
    _proc_exit(status)
}
;
var _exit = exitJS;
var handleException = e=>{
    if (e instanceof ExitStatus || e == "unwind") {
        return EXITSTATUS
    }
    quit_(1, e)
}
;
var maybeExit = ()=>{
    if (!keepRuntimeAlive()) {
        try {
            _exit(EXITSTATUS)
        } catch (e) {
            handleException(e)
        }
    }
}
;
var setMainLoop = (iterFunc,fps,simulateInfiniteLoop,arg,noSetTiming)=>{
    MainLoop.func = iterFunc;
    MainLoop.arg = arg;
    var thisMainLoopId = MainLoop.currentlyRunningMainloop;
    function checkIsRunning() {
        if (thisMainLoopId < MainLoop.currentlyRunningMainloop) {
            maybeExit();
            return false
        }
        return true
    }
    MainLoop.running = false;
    MainLoop.runner = function MainLoop_runner() {
        if (ABORT)
            return;
        if (MainLoop.queue.length > 0) {
            var start = Date.now();
            var blocker = MainLoop.queue.shift();
            blocker.func(blocker.arg);
            if (MainLoop.remainingBlockers) {
                var remaining = MainLoop.remainingBlockers;
                var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
                if (blocker.counted) {
                    MainLoop.remainingBlockers = next
                } else {
                    next = next + .5;
                    MainLoop.remainingBlockers = (8 * remaining + next) / 9
                }
            }
            MainLoop.updateStatus();
            if (!checkIsRunning())
                return;
            setTimeout(MainLoop.runner, 0);
            return
        }
        if (!checkIsRunning())
            return;
        MainLoop.currentFrameNumber = MainLoop.currentFrameNumber + 1 | 0;
        if (MainLoop.timingMode == 1 && MainLoop.timingValue > 1 && MainLoop.currentFrameNumber % MainLoop.timingValue != 0) {
            MainLoop.scheduler();
            return
        } else if (MainLoop.timingMode == 0) {
            MainLoop.tickStartTime = _emscripten_get_now()
        }
        MainLoop.runIter(iterFunc);
        if (!checkIsRunning())
            return;
        MainLoop.scheduler()
    }
    ;
    if (!noSetTiming) {
        if (fps && fps > 0) {
            _emscripten_set_main_loop_timing(0, 1e3 / fps)
        } else {
            _emscripten_set_main_loop_timing(1, 1)
        }
        MainLoop.scheduler()
    }
    if (simulateInfiniteLoop) {
        throw "unwind"
    }
}
;
var callUserCallback = func=>{
    if (ABORT) {
        return
    }
    try {
        func();
        maybeExit()
    } catch (e) {
        handleException(e)
    }
}
;
var MainLoop = {
    running: false,
    scheduler: null,
    method: "",
    currentlyRunningMainloop: 0,
    func: null,
    arg: 0,
    timingMode: 0,
    timingValue: 0,
    currentFrameNumber: 0,
    queue: [],
    preMainLoop: [],
    postMainLoop: [],
    pause() {
        MainLoop.scheduler = null;
        MainLoop.currentlyRunningMainloop++
    },
    resume() {
        MainLoop.currentlyRunningMainloop++;
        var timingMode = MainLoop.timingMode;
        var timingValue = MainLoop.timingValue;
        var func = MainLoop.func;
        MainLoop.func = null;
        setMainLoop(func, 0, false, MainLoop.arg, true);
        _emscripten_set_main_loop_timing(timingMode, timingValue);
        MainLoop.scheduler()
    },
    updateStatus() {
        if (Module["setStatus"]) {
            var message = Module["statusMessage"] || "Please wait...";
            var remaining = MainLoop.remainingBlockers ?? 0;
            var expected = MainLoop.expectedBlockers ?? 0;
            if (remaining) {
                if (remaining < expected) {
                    Module["setStatus"](`{message} ({expected - remaining}/{expected})`)
                } else {
                    Module["setStatus"](message)
                }
            } else {
                Module["setStatus"]("")
            }
        }
    },
    init() {
        Module["preMainLoop"] && MainLoop.preMainLoop.push(Module["preMainLoop"]);
        Module["postMainLoop"] && MainLoop.postMainLoop.push(Module["postMainLoop"])
    },
    runIter(func) {
        if (ABORT)
            return;
        for (var pre of MainLoop.preMainLoop) {
            if (pre() === false) {
                return
            }
        }
        callUserCallback(func);
        for (var post of MainLoop.postMainLoop) {
            post()
        }
    },
    nextRAF: 0,
    fakeRequestAnimationFrame(func) {
        var now = Date.now();
        if (MainLoop.nextRAF === 0) {
            MainLoop.nextRAF = now + 1e3 / 60
        } else {
            while (now + 2 >= MainLoop.nextRAF) {
                MainLoop.nextRAF += 1e3 / 60
            }
        }
        var delay = Math.max(MainLoop.nextRAF - now, 0);
        setTimeout(func, delay)
    },
    requestAnimationFrame(func) {
        if (typeof requestAnimationFrame == "function") {
            requestAnimationFrame(func);
            return
        }
        var RAF = MainLoop.fakeRequestAnimationFrame;
        RAF(func)
    }
};
var _emscripten_cancel_main_loop = ()=>{
    MainLoop.pause();
    MainLoop.func = null
}
;
var _emscripten_date_now = ()=>Date.now();
var _emscripten_pause_main_loop = ()=>{
    MainLoop.pause()
}
;
var JSEvents = {
    removeAllEventListeners() {
        while (JSEvents.eventHandlers.length) {
            JSEvents._removeHandler(JSEvents.eventHandlers.length - 1)
        }
        JSEvents.deferredCalls = []
    },
    inEventHandler: 0,
    deferredCalls: [],
    deferCall(targetFunction, precedence, argsList) {
        function arraysHaveEqualContent(arrA, arrB) {
            if (arrA.length != arrB.length)
                return false;
            for (var i in arrA) {
                if (arrA[i] != arrB[i])
                    return false
            }
            return true
        }
        for (var call of JSEvents.deferredCalls) {
            if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
                return
            }
        }
        JSEvents.deferredCalls.push({
            targetFunction,
            precedence,
            argsList
        });
        JSEvents.deferredCalls.sort((x,y)=>x.precedence < y.precedence)
    },
    removeDeferredCalls(targetFunction) {
        JSEvents.deferredCalls = JSEvents.deferredCalls.filter(call=>call.targetFunction != targetFunction)
    },
    canPerformEventHandlerRequests() {
        if (navigator.userActivation) {
            return navigator.userActivation.isActive
        }
        return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls
    },
    runDeferredCalls() {
        if (!JSEvents.canPerformEventHandlerRequests()) {
            return
        }
        var deferredCalls = JSEvents.deferredCalls;
        JSEvents.deferredCalls = [];
        for (var call of deferredCalls) {
            call.targetFunction(...call.argsList)
        }
    },
    eventHandlers: [],
    removeAllHandlersOnTarget: (target,eventTypeString)=>{
        for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
            if (JSEvents.eventHandlers[i].target == target && (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
                JSEvents._removeHandler(i--)
            }
        }
    }
    ,
    _removeHandler(i) {
        var h = JSEvents.eventHandlers[i];
        h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
        JSEvents.eventHandlers.splice(i, 1)
    },
    registerOrRemoveHandler(eventHandler) {
        if (!eventHandler.target) {
            return -4
        }
        if (eventHandler.callbackfunc) {
            eventHandler.eventListenerFunc = function(event) {
                ++JSEvents.inEventHandler;
                JSEvents.currentEventHandler = eventHandler;
                JSEvents.runDeferredCalls();
                eventHandler.handlerFunc(event);
                JSEvents.runDeferredCalls();
                --JSEvents.inEventHandler
            }
            ;
            eventHandler.target.addEventListener(eventHandler.eventTypeString, eventHandler.eventListenerFunc, eventHandler.useCapture);
            JSEvents.eventHandlers.push(eventHandler)
        } else {
            for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
                if (JSEvents.eventHandlers[i].target == eventHandler.target && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
                    JSEvents._removeHandler(i--)
                }
            }
        }
        return 0
    },
    getNodeNameForTarget(target) {
        if (!target)
            return "";
        if (target == window)
            return "#window";
        if (target == screen)
            return "#screen";
        return target?.nodeName || ""
    },
    fullscreenEnabled() {
        return document.fullscreenEnabled || document.webkitFullscreenEnabled
    }
};
var setLetterbox = (element,topBottom,leftRight)=>{
    element.style.paddingLeft = element.style.paddingRight = leftRight + "px";
    element.style.paddingTop = element.style.paddingBottom = topBottom + "px"
}
;
var maybeCStringToJsString = cString=>cString > 2 ? UTF8ToString(cString) : cString;
var specialHTMLTargets = [0, typeof document != "undefined" ? document : 0, typeof window != "undefined" ? window : 0];
var findEventTarget = target=>{
    target = maybeCStringToJsString(target);
    var domElement = specialHTMLTargets[target] || (typeof document != "undefined" ? document.querySelector(target) : undefined);
    return domElement
}
;
var findCanvasEventTarget = findEventTarget;
var _emscripten_set_canvas_element_size = (target,width,height)=>{
    var canvas = findCanvasEventTarget(target);
    if (!canvas)
        return -4;
    canvas.width = width;
    canvas.height = height;
    return 0
}
;
var _emscripten_get_canvas_element_size = (target,width,height)=>{
    var canvas = findCanvasEventTarget(target);
    if (!canvas)
        return -4;
    HEAP32[width >> 2] = canvas.width;
    HEAP32[height >> 2] = canvas.height
}
;
var stackAlloc = sz=>__emscripten_stack_alloc(sz);
var stringToUTF8OnStack = str=>{
    var size = lengthBytesUTF8(str) + 1;
    var ret = stackAlloc(size);
    stringToUTF8(str, ret, size);
    return ret
}
;
var getCanvasElementSize = target=>{
    var sp = stackSave();
    var w = stackAlloc(8);
    var h = w + 4;
    var targetInt = stringToUTF8OnStack(target.id);
    var ret = _emscripten_get_canvas_element_size(targetInt, w, h);
    var size = [HEAP32[w >> 2], HEAP32[h >> 2]];
    stackRestore(sp);
    return size
}
;
var setCanvasElementSize = (target,width,height)=>{
    if (!target.controlTransferredOffscreen) {
        target.width = width;
        target.height = height
    } else {
        var sp = stackSave();
        var targetInt = stringToUTF8OnStack(target.id);
        _emscripten_set_canvas_element_size(targetInt, width, height);
        stackRestore(sp)
    }
}
;
var wasmTableMirror = [];
var wasmTable;
var getWasmTableEntry = funcPtr=>{
    var func = wasmTableMirror[funcPtr];
    if (!func) {
        if (funcPtr >= wasmTableMirror.length)
            wasmTableMirror.length = funcPtr + 1;
        wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr)
    }
    return func
}
;
var registerRestoreOldStyle = canvas=>{
    var canvasSize = getCanvasElementSize(canvas);
    var oldWidth = canvasSize[0];
    var oldHeight = canvasSize[1];
    var oldCssWidth = canvas.style.width;
    var oldCssHeight = canvas.style.height;
    var oldBackgroundColor = canvas.style.backgroundColor;
    var oldDocumentBackgroundColor = document.body.style.backgroundColor;
    var oldPaddingLeft = canvas.style.paddingLeft;
    var oldPaddingRight = canvas.style.paddingRight;
    var oldPaddingTop = canvas.style.paddingTop;
    var oldPaddingBottom = canvas.style.paddingBottom;
    var oldMarginLeft = canvas.style.marginLeft;
    var oldMarginRight = canvas.style.marginRight;
    var oldMarginTop = canvas.style.marginTop;
    var oldMarginBottom = canvas.style.marginBottom;
    var oldDocumentBodyMargin = document.body.style.margin;
    var oldDocumentOverflow = document.documentElement.style.overflow;
    var oldDocumentScroll = document.body.scroll;
    var oldImageRendering = canvas.style.imageRendering;
    function restoreOldStyle() {
        var fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
        if (!fullscreenElement) {
            document.removeEventListener("fullscreenchange", restoreOldStyle);
            document.removeEventListener("webkitfullscreenchange", restoreOldStyle);
            setCanvasElementSize(canvas, oldWidth, oldHeight);
            canvas.style.width = oldCssWidth;
            canvas.style.height = oldCssHeight;
            canvas.style.backgroundColor = oldBackgroundColor;
            if (!oldDocumentBackgroundColor)
                document.body.style.backgroundColor = "white";
            document.body.style.backgroundColor = oldDocumentBackgroundColor;
            canvas.style.paddingLeft = oldPaddingLeft;
            canvas.style.paddingRight = oldPaddingRight;
            canvas.style.paddingTop = oldPaddingTop;
            canvas.style.paddingBottom = oldPaddingBottom;
            canvas.style.marginLeft = oldMarginLeft;
            canvas.style.marginRight = oldMarginRight;
            canvas.style.marginTop = oldMarginTop;
            canvas.style.marginBottom = oldMarginBottom;
            document.body.style.margin = oldDocumentBodyMargin;
            document.documentElement.style.overflow = oldDocumentOverflow;
            document.body.scroll = oldDocumentScroll;
            canvas.style.imageRendering = oldImageRendering;
            if (canvas.GLctxObject)
                canvas.GLctxObject.GLctx.viewport(0, 0, oldWidth, oldHeight);
            if (currentFullscreenStrategy.canvasResizedCallback) {
                getWasmTableEntry(currentFullscreenStrategy.canvasResizedCallback)(37, 0, currentFullscreenStrategy.canvasResizedCallbackUserData)
            }
        }
    }
    document.addEventListener("fullscreenchange", restoreOldStyle);
    document.addEventListener("webkitfullscreenchange", restoreOldStyle);
    return restoreOldStyle
}
;
var getBoundingClientRect = e=>specialHTMLTargets.indexOf(e) < 0 ? e.getBoundingClientRect() : {
    left: 0,
    top: 0
};
var JSEvents_resizeCanvasForFullscreen = (target,strategy)=>{
    var restoreOldStyle = registerRestoreOldStyle(target);
    var cssWidth = strategy.softFullscreen ? innerWidth : screen.width;
    var cssHeight = strategy.softFullscreen ? innerHeight : screen.height;
    var rect = getBoundingClientRect(target);
    var windowedCssWidth = rect.width;
    var windowedCssHeight = rect.height;
    var canvasSize = getCanvasElementSize(target);
    var windowedRttWidth = canvasSize[0];
    var windowedRttHeight = canvasSize[1];
    if (strategy.scaleMode == 3) {
        setLetterbox(target, (cssHeight - windowedCssHeight) / 2, (cssWidth - windowedCssWidth) / 2);
        cssWidth = windowedCssWidth;
        cssHeight = windowedCssHeight
    } else if (strategy.scaleMode == 2) {
        if (cssWidth * windowedRttHeight < windowedRttWidth * cssHeight) {
            var desiredCssHeight = windowedRttHeight * cssWidth / windowedRttWidth;
            setLetterbox(target, (cssHeight - desiredCssHeight) / 2, 0);
            cssHeight = desiredCssHeight
        } else {
            var desiredCssWidth = windowedRttWidth * cssHeight / windowedRttHeight;
            setLetterbox(target, 0, (cssWidth - desiredCssWidth) / 2);
            cssWidth = desiredCssWidth
        }
    }
    target.style.backgroundColor ||= "black";
    document.body.style.backgroundColor ||= "black";
    target.style.width = cssWidth + "px";
    target.style.height = cssHeight + "px";
    if (strategy.filteringMode == 1) {
        target.style.imageRendering = "optimizeSpeed";
        target.style.imageRendering = "-moz-crisp-edges";
        target.style.imageRendering = "-o-crisp-edges";
        target.style.imageRendering = "-webkit-optimize-contrast";
        target.style.imageRendering = "optimize-contrast";
        target.style.imageRendering = "crisp-edges";
        target.style.imageRendering = "pixelated"
    }
    var dpiScale = strategy.canvasResolutionScaleMode == 2 ? devicePixelRatio : 1;
    if (strategy.canvasResolutionScaleMode != 0) {
        var newWidth = cssWidth * dpiScale | 0;
        var newHeight = cssHeight * dpiScale | 0;
        setCanvasElementSize(target, newWidth, newHeight);
        if (target.GLctxObject)
            target.GLctxObject.GLctx.viewport(0, 0, newWidth, newHeight)
    }
    return restoreOldStyle
}
;
var JSEvents_requestFullscreen = (target,strategy)=>{
    if (strategy.scaleMode != 0 || strategy.canvasResolutionScaleMode != 0) {
        JSEvents_resizeCanvasForFullscreen(target, strategy)
    }
    if (target.requestFullscreen) {
        target.requestFullscreen()
    } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT)
    } else {
        return JSEvents.fullscreenEnabled() ? -3 : -1
    }
    currentFullscreenStrategy = strategy;
    if (strategy.canvasResizedCallback) {
        getWasmTableEntry(strategy.canvasResizedCallback)(37, 0, strategy.canvasResizedCallbackUserData)
    }
    return 0
}
;
var doRequestFullscreen = (target,strategy)=>{
    if (!JSEvents.fullscreenEnabled())
        return -1;
    target = findEventTarget(target);
    if (!target)
        return -4;
    if (!target.requestFullscreen && !target.webkitRequestFullscreen) {
        return -3
    }
    if (!JSEvents.canPerformEventHandlerRequests()) {
        if (strategy.deferUntilInEventHandler) {
            JSEvents.deferCall(JSEvents_requestFullscreen, 1, [target, strategy]);
            return 1
        }
        return -2
    }
    return JSEvents_requestFullscreen(target, strategy)
}
;
var currentFullscreenStrategy = {};
var _emscripten_request_fullscreen_strategy = (target,deferUntilInEventHandler,fullscreenStrategy)=>{
    var strategy = {
        scaleMode: HEAP32[fullscreenStrategy >> 2],
        canvasResolutionScaleMode: HEAP32[fullscreenStrategy + 4 >> 2],
        filteringMode: HEAP32[fullscreenStrategy + 8 >> 2],
        deferUntilInEventHandler,
        canvasResizedCallback: HEAP32[fullscreenStrategy + 12 >> 2],
        canvasResizedCallbackUserData: HEAP32[fullscreenStrategy + 16 >> 2]
    };
    return doRequestFullscreen(target, strategy)
}
;
var getHeapMax = ()=>2147483648;
var growMemory = size=>{
    var b = wasmMemory.buffer;
    var pages = (size - b.byteLength + 65535) / 65536;
    try {
        wasmMemory.grow(pages);
        updateMemoryViews();
        return 1
    } catch (e) {}
}
;
var _emscripten_resize_heap = requestedSize=>{
    var oldSize = HEAPU8.length;
    requestedSize >>>= 0;
    var maxHeapSize = getHeapMax();
    if (requestedSize > maxHeapSize) {
        return false
    }
    for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
        var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
        var replacement = growMemory(newSize);
        if (replacement) {
            return true
        }
    }
    return false
}
;
var _emscripten_resume_main_loop = ()=>{
    MainLoop.resume()
}
;
var _emscripten_set_main_loop = (func,fps,simulateInfiniteLoop)=>{
    var iterFunc = getWasmTableEntry(func);
    setMainLoop(iterFunc, fps, simulateInfiniteLoop)
}
;
function _fd_close(fd) {
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        FS.close(stream);
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return e.errno
    }
}
var doReadv = (stream,iov,iovcnt,offset)=>{
    var ret = 0;
    for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[iov >> 2];
        var len = HEAPU32[iov + 4 >> 2];
        iov += 8;
        var curr = FS.read(stream, HEAP8, ptr, len, offset);
        if (curr < 0)
            return -1;
        ret += curr;
        if (curr < len)
            break;
        if (typeof offset != "undefined") {
            offset += curr
        }
    }
    return ret
}
;
function _fd_read(fd, iov, iovcnt, pnum) {
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var num = doReadv(stream, iov, iovcnt);
        HEAPU32[pnum >> 2] = num;
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return e.errno
    }
}
function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
    var offset = convertI32PairToI53Checked(offset_low, offset_high);
    try {
        if (isNaN(offset))
            return 61;
        var stream = SYSCALLS.getStreamFromFD(fd);
        FS.llseek(stream, offset, whence);
        tempI64 = [stream.position >>> 0, (tempDouble = stream.position,
        +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
        HEAP32[newOffset >> 2] = tempI64[0],
        HEAP32[newOffset + 4 >> 2] = tempI64[1];
        if (stream.getdents && offset === 0 && whence === 0)
            stream.getdents = null;
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return e.errno
    }
}
var doWritev = (stream,iov,iovcnt,offset)=>{
    var ret = 0;
    for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[iov >> 2];
        var len = HEAPU32[iov + 4 >> 2];
        iov += 8;
        var curr = FS.write(stream, HEAP8, ptr, len, offset);
        if (curr < 0)
            return -1;
        ret += curr;
        if (curr < len) {
            break
        }
        if (typeof offset != "undefined") {
            offset += curr
        }
    }
    return ret
}
;
function _fd_write(fd, iov, iovcnt, pnum) {
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var num = doWritev(stream, iov, iovcnt);
        HEAPU32[pnum >> 2] = num;
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
            throw e;
        return e.errno
    }
}
var GLctx;
var webgl_enable_ANGLE_instanced_arrays = ctx=>{
    var ext = ctx.getExtension("ANGLE_instanced_arrays");
    if (ext) {
        ctx["vertexAttribDivisor"] = (index,divisor)=>ext["vertexAttribDivisorANGLE"](index, divisor);
        ctx["drawArraysInstanced"] = (mode,first,count,primcount)=>ext["drawArraysInstancedANGLE"](mode, first, count, primcount);
        ctx["drawElementsInstanced"] = (mode,count,type,indices,primcount)=>ext["drawElementsInstancedANGLE"](mode, count, type, indices, primcount);
        return 1
    }
}
;
var webgl_enable_OES_vertex_array_object = ctx=>{
    var ext = ctx.getExtension("OES_vertex_array_object");
    if (ext) {
        ctx["createVertexArray"] = ()=>ext["createVertexArrayOES"]();
        ctx["deleteVertexArray"] = vao=>ext["deleteVertexArrayOES"](vao);
        ctx["bindVertexArray"] = vao=>ext["bindVertexArrayOES"](vao);
        ctx["isVertexArray"] = vao=>ext["isVertexArrayOES"](vao);
        return 1
    }
}
;
var webgl_enable_WEBGL_draw_buffers = ctx=>{
    var ext = ctx.getExtension("WEBGL_draw_buffers");
    if (ext) {
        ctx["drawBuffers"] = (n,bufs)=>ext["drawBuffersWEBGL"](n, bufs);
        return 1
    }
}
;
var webgl_enable_EXT_polygon_offset_clamp = ctx=>!!(ctx.extPolygonOffsetClamp = ctx.getExtension("EXT_polygon_offset_clamp"));
var webgl_enable_EXT_clip_control = ctx=>!!(ctx.extClipControl = ctx.getExtension("EXT_clip_control"));
var webgl_enable_WEBGL_polygon_mode = ctx=>!!(ctx.webglPolygonMode = ctx.getExtension("WEBGL_polygon_mode"));
var webgl_enable_WEBGL_multi_draw = ctx=>!!(ctx.multiDrawWebgl = ctx.getExtension("WEBGL_multi_draw"));
var getEmscriptenSupportedExtensions = ctx=>{
    var supportedExtensions = ["ANGLE_instanced_arrays", "EXT_blend_minmax", "EXT_disjoint_timer_query", "EXT_frag_depth", "EXT_shader_texture_lod", "EXT_sRGB", "OES_element_index_uint", "OES_fbo_render_mipmap", "OES_standard_derivatives", "OES_texture_float", "OES_texture_half_float", "OES_texture_half_float_linear", "OES_vertex_array_object", "WEBGL_color_buffer_float", "WEBGL_depth_texture", "WEBGL_draw_buffers", "EXT_clip_control", "EXT_color_buffer_half_float", "EXT_depth_clamp", "EXT_float_blend", "EXT_polygon_offset_clamp", "EXT_texture_compression_bptc", "EXT_texture_compression_rgtc", "EXT_texture_filter_anisotropic", "KHR_parallel_shader_compile", "OES_texture_float_linear", "WEBGL_blend_func_extended", "WEBGL_compressed_texture_astc", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_etc1", "WEBGL_compressed_texture_s3tc", "WEBGL_compressed_texture_s3tc_srgb", "WEBGL_debug_renderer_info", "WEBGL_debug_shaders", "WEBGL_lose_context", "WEBGL_multi_draw", "WEBGL_polygon_mode"];
    return (ctx.getSupportedExtensions() || []).filter(ext=>supportedExtensions.includes(ext))
}
;
var GL = {
    counter: 1,
    buffers: [],
    programs: [],
    framebuffers: [],
    renderbuffers: [],
    textures: [],
    shaders: [],
    vaos: [],
    contexts: [],
    offscreenCanvases: {},
    queries: [],
    stringCache: {},
    unpackAlignment: 4,
    unpackRowLength: 0,
    recordError: errorCode=>{
        if (!GL.lastError) {
            GL.lastError = errorCode
        }
    }
    ,
    getNewId: table=>{
        var ret = GL.counter++;
        for (var i = table.length; i < ret; i++) {
            table[i] = null
        }
        return ret
    }
    ,
    genObject: (n,buffers,createFunction,objectTable)=>{
        for (var i = 0; i < n; i++) {
            var buffer = GLctx[createFunction]();
            var id = buffer && GL.getNewId(objectTable);
            if (buffer) {
                buffer.name = id;
                objectTable[id] = buffer
            } else {
                GL.recordError(1282)
            }
            HEAP32[buffers + i * 4 >> 2] = id
        }
    }
    ,
    getSource: (shader,count,string,length)=>{
        var source = "";
        for (var i = 0; i < count; ++i) {
            var len = length ? HEAPU32[length + i * 4 >> 2] : undefined;
            source += UTF8ToString(HEAPU32[string + i * 4 >> 2], len)
        }
        return source
    }
    ,
    createContext: (canvas,webGLContextAttributes)=>{
        if (!canvas.getContextSafariWebGL2Fixed) {
            canvas.getContextSafariWebGL2Fixed = canvas.getContext;
            function fixedGetContext(ver, attrs) {
                var gl = canvas.getContextSafariWebGL2Fixed(ver, attrs);
                return ver == "webgl" == gl instanceof WebGLRenderingContext ? gl : null
            }
            canvas.getContext = fixedGetContext
        }
        var ctx = canvas.getContext("webgl", webGLContextAttributes);
        if (!ctx)
            return 0;
        var handle = GL.registerContext(ctx, webGLContextAttributes);
        return handle
    }
    ,
    registerContext: (ctx,webGLContextAttributes)=>{
        var handle = GL.getNewId(GL.contexts);
        var context = {
            handle,
            attributes: webGLContextAttributes,
            version: webGLContextAttributes.majorVersion,
            GLctx: ctx
        };
        if (ctx.canvas)
            ctx.canvas.GLctxObject = context;
        GL.contexts[handle] = context;
        if (typeof webGLContextAttributes.enableExtensionsByDefault == "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
            GL.initExtensions(context)
        }
        return handle
    }
    ,
    makeContextCurrent: contextHandle=>{
        GL.currentContext = GL.contexts[contextHandle];
        Module.ctx = GLctx = GL.currentContext?.GLctx;
        return !(contextHandle && !GLctx)
    }
    ,
    getContext: contextHandle=>GL.contexts[contextHandle],
    deleteContext: contextHandle=>{
        if (GL.currentContext === GL.contexts[contextHandle]) {
            GL.currentContext = null
        }
        if (typeof JSEvents == "object") {
            JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas)
        }
        if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) {
            GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined
        }
        GL.contexts[contextHandle] = null
    }
    ,
    initExtensions: context=>{
        context ||= GL.currentContext;
        if (context.initExtensionsDone)
            return;
        context.initExtensionsDone = true;
        var GLctx = context.GLctx;
        webgl_enable_WEBGL_multi_draw(GLctx);
        webgl_enable_EXT_polygon_offset_clamp(GLctx);
        webgl_enable_EXT_clip_control(GLctx);
        webgl_enable_WEBGL_polygon_mode(GLctx);
        webgl_enable_ANGLE_instanced_arrays(GLctx);
        webgl_enable_OES_vertex_array_object(GLctx);
        webgl_enable_WEBGL_draw_buffers(GLctx);
        {
            GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query")
        }
        getEmscriptenSupportedExtensions(GLctx).forEach(ext=>{
            if (!ext.includes("lose_context") && !ext.includes("debug")) {
                GLctx.getExtension(ext)
            }
        }
        )
    }
};
var _glActiveTexture = x0=>GLctx.activeTexture(x0);
var _glAttachShader = (program,shader)=>{
    GLctx.attachShader(GL.programs[program], GL.shaders[shader])
}
;
var _glBindBuffer = (target,buffer)=>{
    GLctx.bindBuffer(target, GL.buffers[buffer])
}
;
var _glBindFramebuffer = (target,framebuffer)=>{
    GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer])
}
;
var _glBindRenderbuffer = (target,renderbuffer)=>{
    GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer])
}
;
var _glBindTexture = (target,texture)=>{
    GLctx.bindTexture(target, GL.textures[texture])
}
;
var _glBlendFunc = (x0,x1)=>GLctx.blendFunc(x0, x1);
var _glBufferData = (target,size,data,usage)=>{
    GLctx.bufferData(target, data ? HEAPU8.subarray(data, data + size) : size, usage)
}
;
var _glCheckFramebufferStatus = x0=>GLctx.checkFramebufferStatus(x0);
var _glClear = x0=>GLctx.clear(x0);
var _glClearColor = (x0,x1,x2,x3)=>GLctx.clearColor(x0, x1, x2, x3);
var _glClearStencil = x0=>GLctx.clearStencil(x0);
var _glColorMask = (red,green,blue,alpha)=>{
    GLctx.colorMask(!!red, !!green, !!blue, !!alpha)
}
;
var _glCompileShader = shader=>{
    GLctx.compileShader(GL.shaders[shader])
}
;
var _glCreateProgram = ()=>{
    var id = GL.getNewId(GL.programs);
    var program = GLctx.createProgram();
    program.name = id;
    program.maxUniformLength = program.maxAttributeLength = program.maxUniformBlockNameLength = 0;
    program.uniformIdCounter = 1;
    GL.programs[id] = program;
    return id
}
;
var _glCreateShader = shaderType=>{
    var id = GL.getNewId(GL.shaders);
    GL.shaders[id] = GLctx.createShader(shaderType);
    return id
}
;
var _glDeleteBuffers = (n,buffers)=>{
    for (var i = 0; i < n; i++) {
        var id = HEAP32[buffers + i * 4 >> 2];
        var buffer = GL.buffers[id];
        if (!buffer)
            continue;
        GLctx.deleteBuffer(buffer);
        buffer.name = 0;
        GL.buffers[id] = null
    }
}
;
var _glDeleteFramebuffers = (n,framebuffers)=>{
    for (var i = 0; i < n; ++i) {
        var id = HEAP32[framebuffers + i * 4 >> 2];
        var framebuffer = GL.framebuffers[id];
        if (!framebuffer)
            continue;
        GLctx.deleteFramebuffer(framebuffer);
        framebuffer.name = 0;
        GL.framebuffers[id] = null
    }
}
;
var _glDeleteRenderbuffers = (n,renderbuffers)=>{
    for (var i = 0; i < n; i++) {
        var id = HEAP32[renderbuffers + i * 4 >> 2];
        var renderbuffer = GL.renderbuffers[id];
        if (!renderbuffer)
            continue;
        GLctx.deleteRenderbuffer(renderbuffer);
        renderbuffer.name = 0;
        GL.renderbuffers[id] = null
    }
}
;
var _glDeleteTextures = (n,textures)=>{
    for (var i = 0; i < n; i++) {
        var id = HEAP32[textures + i * 4 >> 2];
        var texture = GL.textures[id];
        if (!texture)
            continue;
        GLctx.deleteTexture(texture);
        texture.name = 0;
        GL.textures[id] = null
    }
}
;
var _glDepthFunc = x0=>GLctx.depthFunc(x0);
var _glDepthMask = flag=>{
    GLctx.depthMask(!!flag)
}
;
var _glDisable = x0=>GLctx.disable(x0);
var _glDisableVertexAttribArray = index=>{
    GLctx.disableVertexAttribArray(index)
}
;
var _glDrawArrays = (mode,first,count)=>{
    GLctx.drawArrays(mode, first, count)
}
;
var _glEnable = x0=>GLctx.enable(x0);
var _glEnableVertexAttribArray = index=>{
    GLctx.enableVertexAttribArray(index)
}
;
var _glFramebufferRenderbuffer = (target,attachment,renderbuffertarget,renderbuffer)=>{
    GLctx.framebufferRenderbuffer(target, attachment, renderbuffertarget, GL.renderbuffers[renderbuffer])
}
;
var _glFramebufferTexture2D = (target,attachment,textarget,texture,level)=>{
    GLctx.framebufferTexture2D(target, attachment, textarget, GL.textures[texture], level)
}
;
var _glGenBuffers = (n,buffers)=>{
    GL.genObject(n, buffers, "createBuffer", GL.buffers)
}
;
var _glGenFramebuffers = (n,ids)=>{
    GL.genObject(n, ids, "createFramebuffer", GL.framebuffers)
}
;
var _glGenRenderbuffers = (n,renderbuffers)=>{
    GL.genObject(n, renderbuffers, "createRenderbuffer", GL.renderbuffers)
}
;
var _glGenTextures = (n,textures)=>{
    GL.genObject(n, textures, "createTexture", GL.textures)
}
;
var _glGetAttribLocation = (program,name)=>GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name));
var writeI53ToI64 = (ptr,num)=>{
    HEAPU32[ptr >> 2] = num;
    var lower = HEAPU32[ptr >> 2];
    HEAPU32[ptr + 4 >> 2] = (num - lower) / 4294967296
}
;
var emscriptenWebGLGet = (name_,p,type)=>{
    if (!p) {
        GL.recordError(1281);
        return
    }
    var ret = undefined;
    switch (name_) {
    case 36346:
        ret = 1;
        break;
    case 36344:
        if (type != 0 && type != 1) {
            GL.recordError(1280)
        }
        return;
    case 36345:
        ret = 0;
        break;
    case 34466:
        var formats = GLctx.getParameter(34467);
        ret = formats ? formats.length : 0;
        break
    }
    if (ret === undefined) {
        var result = GLctx.getParameter(name_);
        switch (typeof result) {
        case "number":
            ret = result;
            break;
        case "boolean":
            ret = result ? 1 : 0;
            break;
        case "string":
            GL.recordError(1280);
            return;
        case "object":
            if (result === null) {
                switch (name_) {
                case 34964:
                case 35725:
                case 34965:
                case 36006:
                case 36007:
                case 32873:
                case 34229:
                case 34068:
                    {
                        ret = 0;
                        break
                    }
                default:
                    {
                        GL.recordError(1280);
                        return
                    }
                }
            } else if (result instanceof Float32Array || result instanceof Uint32Array || result instanceof Int32Array || result instanceof Array) {
                for (var i = 0; i < result.length; ++i) {
                    switch (type) {
                    case 0:
                        HEAP32[p + i * 4 >> 2] = result[i];
                        break;
                    case 2:
                        HEAPF32[p + i * 4 >> 2] = result[i];
                        break;
                    case 4:
                        HEAP8[p + i] = result[i] ? 1 : 0;
                        break
                    }
                }
                return
            } else {
                try {
                    ret = result.name | 0
                } catch (e) {
                    GL.recordError(1280);
                    err(`GL_INVALID_ENUM in glGet${type}v: Unknown object returned from WebGL getParameter(${name_})! (error: ${e})`);
                    return
                }
            }
            break;
        default:
            GL.recordError(1280);
            err(`GL_INVALID_ENUM in glGet${type}v: Native code calling glGet${type}v(${name_}) and it returns ${result} of type ${typeof result}!`);
            return
        }
    }
    switch (type) {
    case 1:
        writeI53ToI64(p, ret);
        break;
    case 0:
        HEAP32[p >> 2] = ret;
        break;
    case 2:
        HEAPF32[p >> 2] = ret;
        break;
    case 4:
        HEAP8[p] = ret ? 1 : 0;
        break
    }
}
;
var _glGetIntegerv = (name_,p)=>emscriptenWebGLGet(name_, p, 0);
var _glGetProgramInfoLog = (program,maxLength,length,infoLog)=>{
    var log = GLctx.getProgramInfoLog(GL.programs[program]);
    if (log === null)
        log = "(unknown error)";
    var numBytesWrittenExclNull = maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0;
    if (length)
        HEAP32[length >> 2] = numBytesWrittenExclNull
}
;
var _glGetProgramiv = (program,pname,p)=>{
    if (!p) {
        GL.recordError(1281);
        return
    }
    if (program >= GL.counter) {
        GL.recordError(1281);
        return
    }
    program = GL.programs[program];
    if (pname == 35716) {
        var log = GLctx.getProgramInfoLog(program);
        if (log === null)
            log = "(unknown error)";
        HEAP32[p >> 2] = log.length + 1
    } else if (pname == 35719) {
        if (!program.maxUniformLength) {
            var numActiveUniforms = GLctx.getProgramParameter(program, 35718);
            for (var i = 0; i < numActiveUniforms; ++i) {
                program.maxUniformLength = Math.max(program.maxUniformLength, GLctx.getActiveUniform(program, i).name.length + 1)
            }
        }
        HEAP32[p >> 2] = program.maxUniformLength
    } else if (pname == 35722) {
        if (!program.maxAttributeLength) {
            var numActiveAttributes = GLctx.getProgramParameter(program, 35721);
            for (var i = 0; i < numActiveAttributes; ++i) {
                program.maxAttributeLength = Math.max(program.maxAttributeLength, GLctx.getActiveAttrib(program, i).name.length + 1)
            }
        }
        HEAP32[p >> 2] = program.maxAttributeLength
    } else if (pname == 35381) {
        if (!program.maxUniformBlockNameLength) {
            var numActiveUniformBlocks = GLctx.getProgramParameter(program, 35382);
            for (var i = 0; i < numActiveUniformBlocks; ++i) {
                program.maxUniformBlockNameLength = Math.max(program.maxUniformBlockNameLength, GLctx.getActiveUniformBlockName(program, i).length + 1)
            }
        }
        HEAP32[p >> 2] = program.maxUniformBlockNameLength
    } else {
        HEAP32[p >> 2] = GLctx.getProgramParameter(program, pname)
    }
}
;
var _glGetShaderInfoLog = (shader,maxLength,length,infoLog)=>{
    var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
    if (log === null)
        log = "(unknown error)";
    var numBytesWrittenExclNull = maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0;
    if (length)
        HEAP32[length >> 2] = numBytesWrittenExclNull
}
;
var _glGetShaderiv = (shader,pname,p)=>{
    if (!p) {
        GL.recordError(1281);
        return
    }
    if (pname == 35716) {
        var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
        if (log === null)
            log = "(unknown error)";
        var logLength = log ? log.length + 1 : 0;
        HEAP32[p >> 2] = logLength
    } else if (pname == 35720) {
        var source = GLctx.getShaderSource(GL.shaders[shader]);
        var sourceLength = source ? source.length + 1 : 0;
        HEAP32[p >> 2] = sourceLength
    } else {
        HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname)
    }
}
;
var jstoi_q = str=>parseInt(str);
var webglGetLeftBracePos = name=>name.slice(-1) == "]" && name.lastIndexOf("[");
var webglPrepareUniformLocationsBeforeFirstUse = program=>{
    var uniformLocsById = program.uniformLocsById, uniformSizeAndIdsByName = program.uniformSizeAndIdsByName, i, j;
    if (!uniformLocsById) {
        program.uniformLocsById = uniformLocsById = {};
        program.uniformArrayNamesById = {};
        var numActiveUniforms = GLctx.getProgramParameter(program, 35718);
        for (i = 0; i < numActiveUniforms; ++i) {
            var u = GLctx.getActiveUniform(program, i);
            var nm = u.name;
            var sz = u.size;
            var lb = webglGetLeftBracePos(nm);
            var arrayName = lb > 0 ? nm.slice(0, lb) : nm;
            var id = program.uniformIdCounter;
            program.uniformIdCounter += sz;
            uniformSizeAndIdsByName[arrayName] = [sz, id];
            for (j = 0; j < sz; ++j) {
                uniformLocsById[id] = j;
                program.uniformArrayNamesById[id++] = arrayName
            }
        }
    }
}
;
var _glGetUniformLocation = (program,name)=>{
    name = UTF8ToString(name);
    if (program = GL.programs[program]) {
        webglPrepareUniformLocationsBeforeFirstUse(program);
        var uniformLocsById = program.uniformLocsById;
        var arrayIndex = 0;
        var uniformBaseName = name;
        var leftBrace = webglGetLeftBracePos(name);
        if (leftBrace > 0) {
            arrayIndex = jstoi_q(name.slice(leftBrace + 1)) >>> 0;
            uniformBaseName = name.slice(0, leftBrace)
        }
        var sizeAndId = program.uniformSizeAndIdsByName[uniformBaseName];
        if (sizeAndId && arrayIndex < sizeAndId[0]) {
            arrayIndex += sizeAndId[1];
            if (uniformLocsById[arrayIndex] = uniformLocsById[arrayIndex] || GLctx.getUniformLocation(program, name)) {
                return arrayIndex
            }
        }
    } else {
        GL.recordError(1281)
    }
    return -1
}
;
var _glLinkProgram = program=>{
    program = GL.programs[program];
    GLctx.linkProgram(program);
    program.uniformLocsById = 0;
    program.uniformSizeAndIdsByName = {}
}
;
var computeUnpackAlignedImageSize = (width,height,sizePerPixel)=>{
    function roundedToNextMultipleOf(x, y) {
        return x + y - 1 & -y
    }
    var plainRowSize = (GL.unpackRowLength || width) * sizePerPixel;
    var alignedRowSize = roundedToNextMultipleOf(plainRowSize, GL.unpackAlignment);
    return height * alignedRowSize
}
;
var colorChannelsInGlTextureFormat = format=>{
    var colorChannels = {
        5: 3,
        6: 4,
        8: 2,
        29502: 3,
        29504: 4
    };
    return colorChannels[format - 6402] || 1
}
;
var heapObjectForWebGLType = type=>{
    type -= 5120;
    if (type == 1)
        return HEAPU8;
    if (type == 4)
        return HEAP32;
    if (type == 6)
        return HEAPF32;
    if (type == 5 || type == 28922)
        return HEAPU32;
    return HEAPU16
}
;
var toTypedArrayIndex = (pointer,heap)=>pointer >>> 31 - Math.clz32(heap.BYTES_PER_ELEMENT);
var emscriptenWebGLGetTexPixelData = (type,format,width,height,pixels,internalFormat)=>{
    var heap = heapObjectForWebGLType(type);
    var sizePerPixel = colorChannelsInGlTextureFormat(format) * heap.BYTES_PER_ELEMENT;
    var bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel);
    return heap.subarray(toTypedArrayIndex(pixels, heap), toTypedArrayIndex(pixels + bytes, heap))
}
;
var _glReadPixels = (x,y,width,height,format,type,pixels)=>{
    var pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, format);
    if (!pixelData) {
        GL.recordError(1280);
        return
    }
    GLctx.readPixels(x, y, width, height, format, type, pixelData)
}
;
var _glRenderbufferStorage = (x0,x1,x2,x3)=>GLctx.renderbufferStorage(x0, x1, x2, x3);
var _glShaderSource = (shader,count,string,length)=>{
    var source = GL.getSource(shader, count, string, length);
    GLctx.shaderSource(GL.shaders[shader], source)
}
;
var _glStencilFunc = (x0,x1,x2)=>GLctx.stencilFunc(x0, x1, x2);
var _glStencilMask = x0=>GLctx.stencilMask(x0);
var _glStencilOp = (x0,x1,x2)=>GLctx.stencilOp(x0, x1, x2);
var _glTexImage2D = (target,level,internalFormat,width,height,border,format,type,pixels)=>{
    var pixelData = pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) : null;
    GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixelData)
}
;
var _glTexParameterf = (x0,x1,x2)=>GLctx.texParameterf(x0, x1, x2);
var _glTexParameteri = (x0,x1,x2)=>GLctx.texParameteri(x0, x1, x2);
var _glTexSubImage2D = (target,level,xoffset,yoffset,width,height,format,type,pixels)=>{
    var pixelData = pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, 0) : null;
    GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixelData)
}
;
var webglGetUniformLocation = location=>{
    var p = GLctx.currentProgram;
    if (p) {
        var webglLoc = p.uniformLocsById[location];
        if (typeof webglLoc == "number") {
            p.uniformLocsById[location] = webglLoc = GLctx.getUniformLocation(p, p.uniformArrayNamesById[location] + (webglLoc > 0 ? `[${webglLoc}]` : ""))
        }
        return webglLoc
    } else {
        GL.recordError(1282)
    }
}
;
var _glUniform1f = (location,v0)=>{
    GLctx.uniform1f(webglGetUniformLocation(location), v0)
}
;
var _glUniform1i = (location,v0)=>{
    GLctx.uniform1i(webglGetUniformLocation(location), v0)
}
;
var _glUniform2f = (location,v0,v1)=>{
    GLctx.uniform2f(webglGetUniformLocation(location), v0, v1)
}
;
var miniTempWebGLFloatBuffers = [];
var _glUniform3fv = (location,count,value)=>{
    if (count <= 96) {
        count *= 3;
        var view = miniTempWebGLFloatBuffers[count];
        for (var i = 0; i < count; i += 3) {
            view[i] = HEAPF32[value + 4 * i >> 2];
            view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
            view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 12 >> 2)
    }
    GLctx.uniform3fv(webglGetUniformLocation(location), view)
}
;
var _glUniformMatrix4fv = (location,count,transpose,value)=>{
    if (count <= 18) {
        var view = miniTempWebGLFloatBuffers[16 * count];
        var heap = HEAPF32;
        value = value >> 2;
        count *= 16;
        for (var i = 0; i < count; i += 16) {
            var dst = value + i;
            view[i] = heap[dst];
            view[i + 1] = heap[dst + 1];
            view[i + 2] = heap[dst + 2];
            view[i + 3] = heap[dst + 3];
            view[i + 4] = heap[dst + 4];
            view[i + 5] = heap[dst + 5];
            view[i + 6] = heap[dst + 6];
            view[i + 7] = heap[dst + 7];
            view[i + 8] = heap[dst + 8];
            view[i + 9] = heap[dst + 9];
            view[i + 10] = heap[dst + 10];
            view[i + 11] = heap[dst + 11];
            view[i + 12] = heap[dst + 12];
            view[i + 13] = heap[dst + 13];
            view[i + 14] = heap[dst + 14];
            view[i + 15] = heap[dst + 15]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 64 >> 2)
    }
    GLctx.uniformMatrix4fv(webglGetUniformLocation(location), !!transpose, view)
}
;
var _glUseProgram = program=>{
    program = GL.programs[program];
    GLctx.useProgram(program);
    GLctx.currentProgram = program
}
;
var _glVertexAttribPointer = (index,size,type,normalized,stride,ptr)=>{
    GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr)
}
;
var _glViewport = (x0,x1,x2,x3)=>GLctx.viewport(x0, x1, x2, x3);
var safeSetTimeout = (func,timeout)=>setTimeout(()=>{
    callUserCallback(func)
}
, timeout);
var warnOnce = text=>{
    warnOnce.shown ||= {};
    if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        if (ENVIRONMENT_IS_NODE)
            text = "warning: " + text;
        err(text)
    }
}
;
var Browser = {
    useWebGL: false,
    isFullscreen: false,
    pointerLock: false,
    moduleContextCreatedCallbacks: [],
    workers: [],
    init() {
        if (Browser.initted)
            return;
        Browser.initted = true;
        var imagePlugin = {};
        imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
            return !Module["noImageDecoding"] && /\.(jpg|jpeg|png|bmp|webp)$/i.test(name)
        }
        ;
        imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
            var b = new Blob([byteArray],{
                type: Browser.getMimetype(name)
            });
            if (b.size !== byteArray.length) {
                b = new Blob([new Uint8Array(byteArray).buffer],{
                    type: Browser.getMimetype(name)
                })
            }
            var url = URL.createObjectURL(b);
            var img = new Image;
            img.onload = ()=>{
                var canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                preloadedImages[name] = canvas;
                URL.revokeObjectURL(url);
                onload?.(byteArray)
            }
            ;
            img.onerror = event=>{
                err(`Image ${url} could not be decoded`);
                onerror?.()
            }
            ;
            img.src = url
        }
        ;
        preloadPlugins.push(imagePlugin);
        var audioPlugin = {};
        audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
            return !Module["noAudioDecoding"] && name.substr(-4)in {
                ".ogg": 1,
                ".wav": 1,
                ".mp3": 1
            }
        }
        ;
        audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
            var done = false;
            function finish(audio) {
                if (done)
                    return;
                done = true;
                preloadedAudios[name] = audio;
                onload?.(byteArray)
            }
            var b = new Blob([byteArray],{
                type: Browser.getMimetype(name)
            });
            var url = URL.createObjectURL(b);
            var audio = new Audio;
            audio.addEventListener("canplaythrough", ()=>finish(audio), false);
            audio.onerror = function audio_onerror(event) {
                if (done)
                    return;
                err(`warning: browser could not fully decode audio ${name}, trying slower base64 approach`);
                function encode64(data) {
                    var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                    var PAD = "=";
                    var ret = "";
                    var leftchar = 0;
                    var leftbits = 0;
                    for (var i = 0; i < data.length; i++) {
                        leftchar = leftchar << 8 | data[i];
                        leftbits += 8;
                        while (leftbits >= 6) {
                            var curr = leftchar >> leftbits - 6 & 63;
                            leftbits -= 6;
                            ret += BASE[curr]
                        }
                    }
                    if (leftbits == 2) {
                        ret += BASE[(leftchar & 3) << 4];
                        ret += PAD + PAD
                    } else if (leftbits == 4) {
                        ret += BASE[(leftchar & 15) << 2];
                        ret += PAD
                    }
                    return ret
                }
                audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
                finish(audio)
            }
            ;
            audio.src = url;
            safeSetTimeout(()=>{
                finish(audio)
            }
            , 1e4)
        }
        ;
        preloadPlugins.push(audioPlugin);
        function pointerLockChange() {
            Browser.pointerLock = document["pointerLockElement"] === Module["canvas"] || document["mozPointerLockElement"] === Module["canvas"] || document["webkitPointerLockElement"] === Module["canvas"] || document["msPointerLockElement"] === Module["canvas"]
        }
        var canvas = Module["canvas"];
        if (canvas) {
            canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || (()=>{}
            );
            canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || (()=>{}
            );
            canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
            document.addEventListener("pointerlockchange", pointerLockChange, false);
            document.addEventListener("mozpointerlockchange", pointerLockChange, false);
            document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
            document.addEventListener("mspointerlockchange", pointerLockChange, false);
            if (Module["elementPointerLock"]) {
                canvas.addEventListener("click", ev=>{
                    if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
                        Module["canvas"].requestPointerLock();
                        ev.preventDefault()
                    }
                }
                , false)
            }
        }
    },
    createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module.ctx && canvas == Module.canvas)
            return Module.ctx;
        var ctx;
        var contextHandle;
        if (useWebGL) {
            var contextAttributes = {
                antialias: false,
                alpha: false,
                majorVersion: 1
            };
            if (webGLContextAttributes) {
                for (var attribute in webGLContextAttributes) {
                    contextAttributes[attribute] = webGLContextAttributes[attribute]
                }
            }
            if (typeof GL != "undefined") {
                contextHandle = GL.createContext(canvas, contextAttributes);
                if (contextHandle) {
                    ctx = GL.getContext(contextHandle).GLctx
                }
            }
        } else {
            ctx = canvas.getContext("2d")
        }
        if (!ctx)
            return null;
        if (setInModule) {
            Module.ctx = ctx;
            if (useWebGL)
                GL.makeContextCurrent(contextHandle);
            Browser.useWebGL = useWebGL;
            Browser.moduleContextCreatedCallbacks.forEach(callback=>callback());
            Browser.init()
        }
        return ctx
    },
    fullscreenHandlersInstalled: false,
    lockPointer: undefined,
    resizeCanvas: undefined,
    requestFullscreen(lockPointer, resizeCanvas) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        if (typeof Browser.lockPointer == "undefined")
            Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas == "undefined")
            Browser.resizeCanvas = false;
        var canvas = Module["canvas"];
        function fullscreenChange() {
            Browser.isFullscreen = false;
            var canvasContainer = canvas.parentNode;
            if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
                canvas.exitFullscreen = Browser.exitFullscreen;
                if (Browser.lockPointer)
                    canvas.requestPointerLock();
                Browser.isFullscreen = true;
                if (Browser.resizeCanvas) {
                    Browser.setFullscreenCanvasSize()
                } else {
                    Browser.updateCanvasDimensions(canvas)
                }
            } else {
                canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
                canvasContainer.parentNode.removeChild(canvasContainer);
                if (Browser.resizeCanvas) {
                    Browser.setWindowedCanvasSize()
                } else {
                    Browser.updateCanvasDimensions(canvas)
                }
            }
            Module["onFullScreen"]?.(Browser.isFullscreen);
            Module["onFullscreen"]?.(Browser.isFullscreen)
        }
        if (!Browser.fullscreenHandlersInstalled) {
            Browser.fullscreenHandlersInstalled = true;
            document.addEventListener("fullscreenchange", fullscreenChange, false);
            document.addEventListener("mozfullscreenchange", fullscreenChange, false);
            document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
            document.addEventListener("MSFullscreenChange", fullscreenChange, false)
        }
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
        canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? ()=>canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"]) : null) || (canvasContainer["webkitRequestFullScreen"] ? ()=>canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]) : null);
        canvasContainer.requestFullscreen()
    },
    exitFullscreen() {
        if (!Browser.isFullscreen) {
            return false
        }
        var CFS = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || (()=>{}
        );
        CFS.apply(document, []);
        return true
    },
    safeSetTimeout(func, timeout) {
        return safeSetTimeout(func, timeout)
    },
    getMimetype(name) {
        return {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            bmp: "image/bmp",
            ogg: "audio/ogg",
            wav: "audio/wav",
            mp3: "audio/mpeg"
        }[name.substr(name.lastIndexOf(".") + 1)]
    },
    getUserMedia(func) {
        window.getUserMedia ||= navigator["getUserMedia"] || navigator["mozGetUserMedia"];
        window.getUserMedia(func)
    },
    getMovementX(event) {
        return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0
    },
    getMovementY(event) {
        return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0
    },
    getMouseWheelDelta(event) {
        var delta = 0;
        switch (event.type) {
        case "DOMMouseScroll":
            delta = event.detail / 3;
            break;
        case "mousewheel":
            delta = event.wheelDelta / 120;
            break;
        case "wheel":
            delta = event.deltaY;
            switch (event.deltaMode) {
            case 0:
                delta /= 100;
                break;
            case 1:
                delta /= 3;
                break;
            case 2:
                delta *= 80;
                break;
            default:
                throw "unrecognized mouse wheel delta mode: " + event.deltaMode
            }
            break;
        default:
            throw "unrecognized mouse wheel event: " + event.type
        }
        return delta
    },
    mouseX: 0,
    mouseY: 0,
    mouseMovementX: 0,
    mouseMovementY: 0,
    touches: {},
    lastTouches: {},
    calculateMouseCoords(pageX, pageY) {
        var rect = Module["canvas"].getBoundingClientRect();
        var cw = Module["canvas"].width;
        var ch = Module["canvas"].height;
        var scrollX = typeof window.scrollX != "undefined" ? window.scrollX : window.pageXOffset;
        var scrollY = typeof window.scrollY != "undefined" ? window.scrollY : window.pageYOffset;
        var adjustedX = pageX - (scrollX + rect.left);
        var adjustedY = pageY - (scrollY + rect.top);
        adjustedX = adjustedX * (cw / rect.width);
        adjustedY = adjustedY * (ch / rect.height);
        return {
            x: adjustedX,
            y: adjustedY
        }
    },
    setMouseCoords(pageX, pageY) {
        const {x, y} = Browser.calculateMouseCoords(pageX, pageY);
        Browser.mouseMovementX = x - Browser.mouseX;
        Browser.mouseMovementY = y - Browser.mouseY;
        Browser.mouseX = x;
        Browser.mouseY = y
    },
    calculateMouseEvent(event) {
        if (Browser.pointerLock) {
            if (event.type != "mousemove" && "mozMovementX"in event) {
                Browser.mouseMovementX = Browser.mouseMovementY = 0
            } else {
                Browser.mouseMovementX = Browser.getMovementX(event);
                Browser.mouseMovementY = Browser.getMovementY(event)
            }
            Browser.mouseX += Browser.mouseMovementX;
            Browser.mouseY += Browser.mouseMovementY
        } else {
            if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
                var touch = event.touch;
                if (touch === undefined) {
                    return
                }
                var coords = Browser.calculateMouseCoords(touch.pageX, touch.pageY);
                if (event.type === "touchstart") {
                    Browser.lastTouches[touch.identifier] = coords;
                    Browser.touches[touch.identifier] = coords
                } else if (event.type === "touchend" || event.type === "touchmove") {
                    var last = Browser.touches[touch.identifier];
                    last ||= coords;
                    Browser.lastTouches[touch.identifier] = last;
                    Browser.touches[touch.identifier] = coords
                }
                return
            }
            Browser.setMouseCoords(event.pageX, event.pageY)
        }
    },
    resizeListeners: [],
    updateResizeListeners() {
        var canvas = Module["canvas"];
        Browser.resizeListeners.forEach(listener=>listener(canvas.width, canvas.height))
    },
    setCanvasSize(width, height, noUpdates) {
        var canvas = Module["canvas"];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates)
            Browser.updateResizeListeners()
    },
    windowedWidth: 0,
    windowedHeight: 0,
    setFullscreenCanvasSize() {
        if (typeof SDL != "undefined") {
            var flags = HEAPU32[SDL.screen >> 2];
            flags = flags | 8388608;
            HEAP32[SDL.screen >> 2] = flags
        }
        Browser.updateCanvasDimensions(Module["canvas"]);
        Browser.updateResizeListeners()
    },
    setWindowedCanvasSize() {
        if (typeof SDL != "undefined") {
            var flags = HEAPU32[SDL.screen >> 2];
            flags = flags & ~8388608;
            HEAP32[SDL.screen >> 2] = flags
        }
        Browser.updateCanvasDimensions(Module["canvas"]);
        Browser.updateResizeListeners()
    },
    updateCanvasDimensions(canvas, wNative, hNative) {
        if (wNative && hNative) {
            canvas.widthNative = wNative;
            canvas.heightNative = hNative
        } else {
            wNative = canvas.widthNative;
            hNative = canvas.heightNative
        }
        var w = wNative;
        var h = hNative;
        if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
            if (w / h < Module["forcedAspectRatio"]) {
                w = Math.round(h * Module["forcedAspectRatio"])
            } else {
                h = Math.round(w / Module["forcedAspectRatio"])
            }
        }
        if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
            var factor = Math.min(screen.width / w, screen.height / h);
            w = Math.round(w * factor);
            h = Math.round(h * factor)
        }
        if (Browser.resizeCanvas) {
            if (canvas.width != w)
                canvas.width = w;
            if (canvas.height != h)
                canvas.height = h;
            if (typeof canvas.style != "undefined") {
                canvas.style.removeProperty("width");
                canvas.style.removeProperty("height")
            }
        } else {
            if (canvas.width != wNative)
                canvas.width = wNative;
            if (canvas.height != hNative)
                canvas.height = hNative;
            if (typeof canvas.style != "undefined") {
                if (w != wNative || h != hNative) {
                    canvas.style.setProperty("width", w + "px", "important");
                    canvas.style.setProperty("height", h + "px", "important")
                } else {
                    canvas.style.removeProperty("width");
                    canvas.style.removeProperty("height")
                }
            }
        }
    }
};
function GLFW_Window(id, width, height, framebufferWidth, framebufferHeight, title, monitor, share) {
    this.id = id;
    this.x = 0;
    this.y = 0;
    this.fullscreen = false;
    this.storedX = 0;
    this.storedY = 0;
    this.width = width;
    this.height = height;
    this.framebufferWidth = framebufferWidth;
    this.framebufferHeight = framebufferHeight;
    this.storedWidth = width;
    this.storedHeight = height;
    this.title = title;
    this.monitor = monitor;
    this.share = share;
    this.attributes = Object.assign({}, GLFW.hints);
    this.inputModes = {
        208897: 212993,
        208898: 0,
        208899: 0
    };
    this.buttons = 0;
    this.keys = new Array;
    this.domKeys = new Array;
    this.shouldClose = 0;
    this.title = null;
    this.windowPosFunc = 0;
    this.windowSizeFunc = 0;
    this.windowCloseFunc = 0;
    this.windowRefreshFunc = 0;
    this.windowFocusFunc = 0;
    this.windowIconifyFunc = 0;
    this.windowMaximizeFunc = 0;
    this.framebufferSizeFunc = 0;
    this.windowContentScaleFunc = 0;
    this.mouseButtonFunc = 0;
    this.cursorPosFunc = 0;
    this.cursorEnterFunc = 0;
    this.scrollFunc = 0;
    this.dropFunc = 0;
    this.keyFunc = 0;
    this.charFunc = 0;
    this.userptr = 0
}
var stringToNewUTF8 = str=>{
    var size = lengthBytesUTF8(str) + 1;
    var ret = _malloc(size);
    if (ret)
        stringToUTF8(str, ret, size);
    return ret
}
;
var _emscripten_set_window_title = title=>document.title = UTF8ToString(title);
var GLFW = {
    WindowFromId: id=>{
        if (id <= 0 || !GLFW.windows)
            return null;
        return GLFW.windows[id - 1]
    }
    ,
    joystickFunc: 0,
    errorFunc: 0,
    monitorFunc: 0,
    active: null,
    scale: null,
    windows: null,
    monitors: null,
    monitorString: null,
    versionString: null,
    initialTime: null,
    extensions: null,
    devicePixelRatioMQL: null,
    hints: null,
    primaryTouchId: null,
    defaultHints: {
        131073: 0,
        131074: 0,
        131075: 1,
        131076: 1,
        131077: 1,
        131082: 0,
        135169: 8,
        135170: 8,
        135171: 8,
        135172: 8,
        135173: 24,
        135174: 8,
        135175: 0,
        135176: 0,
        135177: 0,
        135178: 0,
        135179: 0,
        135180: 0,
        135181: 0,
        135182: 0,
        135183: 0,
        139265: 196609,
        139266: 1,
        139267: 0,
        139268: 0,
        139269: 0,
        139270: 0,
        139271: 0,
        139272: 0,
        139276: 0
    },
    DOMToGLFWKeyCode: keycode=>{
        switch (keycode) {
        case 32:
            return 32;
        case 222:
            return 39;
        case 188:
            return 44;
        case 173:
            return 45;
        case 189:
            return 45;
        case 190:
            return 46;
        case 191:
            return 47;
        case 48:
            return 48;
        case 49:
            return 49;
        case 50:
            return 50;
        case 51:
            return 51;
        case 52:
            return 52;
        case 53:
            return 53;
        case 54:
            return 54;
        case 55:
            return 55;
        case 56:
            return 56;
        case 57:
            return 57;
        case 59:
            return 59;
        case 61:
            return 61;
        case 187:
            return 61;
        case 65:
            return 65;
        case 66:
            return 66;
        case 67:
            return 67;
        case 68:
            return 68;
        case 69:
            return 69;
        case 70:
            return 70;
        case 71:
            return 71;
        case 72:
            return 72;
        case 73:
            return 73;
        case 74:
            return 74;
        case 75:
            return 75;
        case 76:
            return 76;
        case 77:
            return 77;
        case 78:
            return 78;
        case 79:
            return 79;
        case 80:
            return 80;
        case 81:
            return 81;
        case 82:
            return 82;
        case 83:
            return 83;
        case 84:
            return 84;
        case 85:
            return 85;
        case 86:
            return 86;
        case 87:
            return 87;
        case 88:
            return 88;
        case 89:
            return 89;
        case 90:
            return 90;
        case 219:
            return 91;
        case 220:
            return 92;
        case 221:
            return 93;
        case 192:
            return 96;
        case 27:
            return 256;
        case 13:
            return 257;
        case 9:
            return 258;
        case 8:
            return 259;
        case 45:
            return 260;
        case 46:
            return 261;
        case 39:
            return 262;
        case 37:
            return 263;
        case 40:
            return 264;
        case 38:
            return 265;
        case 33:
            return 266;
        case 34:
            return 267;
        case 36:
            return 268;
        case 35:
            return 269;
        case 20:
            return 280;
        case 145:
            return 281;
        case 144:
            return 282;
        case 44:
            return 283;
        case 19:
            return 284;
        case 112:
            return 290;
        case 113:
            return 291;
        case 114:
            return 292;
        case 115:
            return 293;
        case 116:
            return 294;
        case 117:
            return 295;
        case 118:
            return 296;
        case 119:
            return 297;
        case 120:
            return 298;
        case 121:
            return 299;
        case 122:
            return 300;
        case 123:
            return 301;
        case 124:
            return 302;
        case 125:
            return 303;
        case 126:
            return 304;
        case 127:
            return 305;
        case 128:
            return 306;
        case 129:
            return 307;
        case 130:
            return 308;
        case 131:
            return 309;
        case 132:
            return 310;
        case 133:
            return 311;
        case 134:
            return 312;
        case 135:
            return 313;
        case 136:
            return 314;
        case 96:
            return 320;
        case 97:
            return 321;
        case 98:
            return 322;
        case 99:
            return 323;
        case 100:
            return 324;
        case 101:
            return 325;
        case 102:
            return 326;
        case 103:
            return 327;
        case 104:
            return 328;
        case 105:
            return 329;
        case 110:
            return 330;
        case 111:
            return 331;
        case 106:
            return 332;
        case 109:
            return 333;
        case 107:
            return 334;
        case 16:
            return 340;
        case 17:
            return 341;
        case 18:
            return 342;
        case 91:
            return 343;
        case 224:
            return 343;
        case 93:
            return 348;
        default:
            return -1
        }
    }
    ,
    getModBits: win=>{
        var mod = 0;
        if (win.keys[340])
            mod |= 1;
        if (win.keys[341])
            mod |= 2;
        if (win.keys[342])
            mod |= 4;
        if (win.keys[343] || win.keys[348])
            mod |= 8;
        return mod
    }
    ,
    onKeyPress: event=>{
        if (!GLFW.active || !GLFW.active.charFunc)
            return;
        if (event.ctrlKey || event.metaKey)
            return;
        var charCode = event.charCode;
        if (charCode == 0 || charCode >= 0 && charCode <= 31)
            return;
        getWasmTableEntry(GLFW.active.charFunc)(GLFW.active.id, charCode)
    }
    ,
    onKeyChanged: (keyCode,status)=>{
        if (!GLFW.active)
            return;
        var key = GLFW.DOMToGLFWKeyCode(keyCode);
        if (key == -1)
            return;
        var repeat = status && GLFW.active.keys[key];
        GLFW.active.keys[key] = status;
        GLFW.active.domKeys[keyCode] = status;
        if (GLFW.active.keyFunc) {
            if (repeat)
                status = 2;
            getWasmTableEntry(GLFW.active.keyFunc)(GLFW.active.id, key, keyCode, status, GLFW.getModBits(GLFW.active))
        }
    }
    ,
    onGamepadConnected: event=>{
        GLFW.refreshJoysticks()
    }
    ,
    onGamepadDisconnected: event=>{
        GLFW.refreshJoysticks()
    }
    ,
    onKeydown: event=>{
        GLFW.onKeyChanged(event.keyCode, 1);
        if (event.keyCode === 8 || event.keyCode === 9) {
            event.preventDefault()
        }
    }
    ,
    onKeyup: event=>{
        GLFW.onKeyChanged(event.keyCode, 0)
    }
    ,
    onBlur: event=>{
        if (!GLFW.active)
            return;
        for (var i = 0; i < GLFW.active.domKeys.length; ++i) {
            if (GLFW.active.domKeys[i]) {
                GLFW.onKeyChanged(i, 0)
            }
        }
    }
    ,
    onMousemove: event=>{
        if (!GLFW.active)
            return;
        if (event.type === "touchmove") {
            event.preventDefault();
            let primaryChanged = false;
            for (let i of event.changedTouches) {
                if (GLFW.primaryTouchId === i.identifier) {
                    Browser.setMouseCoords(i.pageX, i.pageY);
                    primaryChanged = true;
                    break
                }
            }
            if (!primaryChanged) {
                return
            }
        } else {
            Browser.calculateMouseEvent(event)
        }
        if (event.target != Module["canvas"] || !GLFW.active.cursorPosFunc)
            return;
        if (GLFW.active.cursorPosFunc) {
            getWasmTableEntry(GLFW.active.cursorPosFunc)(GLFW.active.id, Browser.mouseX, Browser.mouseY)
        }
    }
    ,
    DOMToGLFWMouseButton: event=>{
        var eventButton = event["button"];
        if (eventButton > 0) {
            if (eventButton == 1) {
                eventButton = 2
            } else {
                eventButton = 1
            }
        }
        return eventButton
    }
    ,
    onMouseenter: event=>{
        if (!GLFW.active)
            return;
        if (event.target != Module["canvas"])
            return;
        if (GLFW.active.cursorEnterFunc) {
            getWasmTableEntry(GLFW.active.cursorEnterFunc)(GLFW.active.id, 1)
        }
    }
    ,
    onMouseleave: event=>{
        if (!GLFW.active)
            return;
        if (event.target != Module["canvas"])
            return;
        if (GLFW.active.cursorEnterFunc) {
            getWasmTableEntry(GLFW.active.cursorEnterFunc)(GLFW.active.id, 0)
        }
    }
    ,
    onMouseButtonChanged: (event,status)=>{
        if (!GLFW.active)
            return;
        if (event.target != Module["canvas"])
            return;
        const isTouchType = event.type === "touchstart" || event.type === "touchend" || event.type === "touchcancel";
        let eventButton = 0;
        if (isTouchType) {
            event.preventDefault();
            let primaryChanged = false;
            if (GLFW.primaryTouchId === null && event.type === "touchstart" && event.targetTouches.length > 0) {
                const chosenTouch = event.targetTouches[0];
                GLFW.primaryTouchId = chosenTouch.identifier;
                Browser.setMouseCoords(chosenTouch.pageX, chosenTouch.pageY);
                primaryChanged = true
            } else if (event.type === "touchend" || event.type === "touchcancel") {
                for (let i of event.changedTouches) {
                    if (GLFW.primaryTouchId === i.identifier) {
                        GLFW.primaryTouchId = null;
                        primaryChanged = true;
                        break
                    }
                }
            }
            if (!primaryChanged) {
                return
            }
        } else {
            Browser.calculateMouseEvent(event);
            eventButton = GLFW.DOMToGLFWMouseButton(event)
        }
        if (status == 1) {
            GLFW.active.buttons |= 1 << eventButton;
            try {
                event.target.setCapture()
            } catch (e) {}
        } else {
            GLFW.active.buttons &= ~(1 << eventButton)
        }
        if (GLFW.active.mouseButtonFunc) {
            getWasmTableEntry(GLFW.active.mouseButtonFunc)(GLFW.active.id, eventButton, status, GLFW.getModBits(GLFW.active))
        }
    }
    ,
    onMouseButtonDown: event=>{
        if (!GLFW.active)
            return;
        GLFW.onMouseButtonChanged(event, 1)
    }
    ,
    onMouseButtonUp: event=>{
        if (!GLFW.active)
            return;
        GLFW.onMouseButtonChanged(event, 0)
    }
    ,
    onMouseWheel: event=>{
        var delta = -Browser.getMouseWheelDelta(event);
        delta = delta == 0 ? 0 : delta > 0 ? Math.max(delta, 1) : Math.min(delta, -1);
        GLFW.wheelPos += delta;
        if (!GLFW.active || !GLFW.active.scrollFunc || event.target != Module["canvas"])
            return;
        var sx = 0;
        var sy = delta;
        if (event.type == "mousewheel") {
            sx = event.wheelDeltaX
        } else {
            sx = event.deltaX
        }
        getWasmTableEntry(GLFW.active.scrollFunc)(GLFW.active.id, sx, sy);
        event.preventDefault()
    }
    ,
    onCanvasResize: (width,height,framebufferWidth,framebufferHeight)=>{
        if (!GLFW.active)
            return;
        var resizeNeeded = false;
        if (document["fullscreen"] || document["fullScreen"] || document["mozFullScreen"] || document["webkitIsFullScreen"]) {
            if (!GLFW.active.fullscreen) {
                resizeNeeded = width != screen.width || height != screen.height;
                GLFW.active.storedX = GLFW.active.x;
                GLFW.active.storedY = GLFW.active.y;
                GLFW.active.storedWidth = GLFW.active.width;
                GLFW.active.storedHeight = GLFW.active.height;
                GLFW.active.x = GLFW.active.y = 0;
                GLFW.active.width = screen.width;
                GLFW.active.height = screen.height;
                GLFW.active.fullscreen = true
            }
        } else if (GLFW.active.fullscreen == true) {
            resizeNeeded = width != GLFW.active.storedWidth || height != GLFW.active.storedHeight;
            GLFW.active.x = GLFW.active.storedX;
            GLFW.active.y = GLFW.active.storedY;
            GLFW.active.width = GLFW.active.storedWidth;
            GLFW.active.height = GLFW.active.storedHeight;
            GLFW.active.fullscreen = false
        }
        if (resizeNeeded) {
            Browser.setCanvasSize(GLFW.active.width, GLFW.active.height)
        } else if (GLFW.active.width != width || GLFW.active.height != height || GLFW.active.framebufferWidth != framebufferWidth || GLFW.active.framebufferHeight != framebufferHeight) {
            GLFW.active.width = width;
            GLFW.active.height = height;
            GLFW.active.framebufferWidth = framebufferWidth;
            GLFW.active.framebufferHeight = framebufferHeight;
            GLFW.onWindowSizeChanged();
            GLFW.onFramebufferSizeChanged()
        }
    }
    ,
    onWindowSizeChanged: ()=>{
        if (!GLFW.active)
            return;
        if (GLFW.active.windowSizeFunc) {
            getWasmTableEntry(GLFW.active.windowSizeFunc)(GLFW.active.id, GLFW.active.width, GLFW.active.height)
        }
    }
    ,
    onFramebufferSizeChanged: ()=>{
        if (!GLFW.active)
            return;
        if (GLFW.active.framebufferSizeFunc) {
            getWasmTableEntry(GLFW.active.framebufferSizeFunc)(GLFW.active.id, GLFW.active.framebufferWidth, GLFW.active.framebufferHeight)
        }
    }
    ,
    onWindowContentScaleChanged: scale=>{
        GLFW.scale = scale;
        if (!GLFW.active)
            return;
        if (GLFW.active.windowContentScaleFunc) {
            getWasmTableEntry(GLFW.active.windowContentScaleFunc)(GLFW.active.id, GLFW.scale, GLFW.scale)
        }
    }
    ,
    getTime: ()=>_emscripten_get_now() / 1e3,
    setWindowTitle: (winid,title)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return;
        win.title = title;
        if (GLFW.active.id == win.id) {
            _emscripten_set_window_title(title)
        }
    }
    ,
    setJoystickCallback: cbfun=>{
        var prevcbfun = GLFW.joystickFunc;
        GLFW.joystickFunc = cbfun;
        GLFW.refreshJoysticks();
        return prevcbfun
    }
    ,
    joys: {},
    lastGamepadState: [],
    lastGamepadStateFrame: null,
    refreshJoysticks: ()=>{
        if (MainLoop.currentFrameNumber !== GLFW.lastGamepadStateFrame || !MainLoop.currentFrameNumber) {
            GLFW.lastGamepadState = navigator.getGamepads ? navigator.getGamepads() : navigator.webkitGetGamepads || [];
            GLFW.lastGamepadStateFrame = MainLoop.currentFrameNumber;
            for (var joy = 0; joy < GLFW.lastGamepadState.length; ++joy) {
                var gamepad = GLFW.lastGamepadState[joy];
                if (gamepad) {
                    if (!GLFW.joys[joy]) {
                        out("glfw joystick connected:", joy);
                        GLFW.joys[joy] = {
                            id: stringToNewUTF8(gamepad.id),
                            buttonsCount: gamepad.buttons.length,
                            axesCount: gamepad.axes.length,
                            buttons: _malloc(gamepad.buttons.length),
                            axes: _malloc(gamepad.axes.length * 4)
                        };
                        if (GLFW.joystickFunc) {
                            getWasmTableEntry(GLFW.joystickFunc)(joy, 262145)
                        }
                    }
                    var data = GLFW.joys[joy];
                    for (var i = 0; i < gamepad.buttons.length; ++i) {
                        HEAP8[data.buttons + i] = gamepad.buttons[i].pressed
                    }
                    for (var i = 0; i < gamepad.axes.length; ++i) {
                        HEAPF32[data.axes + i * 4 >> 2] = gamepad.axes[i]
                    }
                } else {
                    if (GLFW.joys[joy]) {
                        out("glfw joystick disconnected", joy);
                        if (GLFW.joystickFunc) {
                            getWasmTableEntry(GLFW.joystickFunc)(joy, 262146)
                        }
                        _free(GLFW.joys[joy].id);
                        _free(GLFW.joys[joy].buttons);
                        _free(GLFW.joys[joy].axes);
                        delete GLFW.joys[joy]
                    }
                }
            }
        }
    }
    ,
    setKeyCallback: (winid,cbfun)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return null;
        var prevcbfun = win.keyFunc;
        win.keyFunc = cbfun;
        return prevcbfun
    }
    ,
    setCharCallback: (winid,cbfun)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return null;
        var prevcbfun = win.charFunc;
        win.charFunc = cbfun;
        return prevcbfun
    }
    ,
    setMouseButtonCallback: (winid,cbfun)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return null;
        var prevcbfun = win.mouseButtonFunc;
        win.mouseButtonFunc = cbfun;
        return prevcbfun
    }
    ,
    setCursorPosCallback: (winid,cbfun)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return null;
        var prevcbfun = win.cursorPosFunc;
        win.cursorPosFunc = cbfun;
        return prevcbfun
    }
    ,
    setScrollCallback: (winid,cbfun)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return null;
        var prevcbfun = win.scrollFunc;
        win.scrollFunc = cbfun;
        return prevcbfun
    }
    ,
    setDropCallback: (winid,cbfun)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return null;
        var prevcbfun = win.dropFunc;
        win.dropFunc = cbfun;
        return prevcbfun
    }
    ,
    onDrop: event=>{
        if (!GLFW.active || !GLFW.active.dropFunc)
            return;
        if (!event.dataTransfer || !event.dataTransfer.files || event.dataTransfer.files.length == 0)
            return;
        event.preventDefault();
        var filenames = _malloc(event.dataTransfer.files.length * 4);
        var filenamesArray = [];
        var count = event.dataTransfer.files.length;
        var written = 0;
        var drop_dir = ".glfw_dropped_files";
        FS.createPath("/", drop_dir);
        function save(file) {
            var path = "/" + drop_dir + "/" + file.name.replace(/\//g, "_");
            var reader = new FileReader;
            reader.onloadend = e=>{
                if (reader.readyState != 2) {
                    ++written;
                    out("failed to read dropped file: " + file.name + ": " + reader.error);
                    return
                }
                var data = e.target.result;
                FS.writeFile(path, new Uint8Array(data));
                if (++written === count) {
                    getWasmTableEntry(GLFW.active.dropFunc)(GLFW.active.id, count, filenames);
                    for (var i = 0; i < filenamesArray.length; ++i) {
                        _free(filenamesArray[i])
                    }
                    _free(filenames)
                }
            }
            ;
            reader.readAsArrayBuffer(file);
            var filename = stringToNewUTF8(path);
            filenamesArray.push(filename);
            HEAPU32[filenames + i * 4 >> 2] = filename
        }
        for (var i = 0; i < count; ++i) {
            save(event.dataTransfer.files[i])
        }
        return false
    }
    ,
    onDragover: event=>{
        if (!GLFW.active || !GLFW.active.dropFunc)
            return;
        event.preventDefault();
        return false
    }
    ,
    setWindowSizeCallback: (winid,cbfun)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return null;
        var prevcbfun = win.windowSizeFunc;
        win.windowSizeFunc = cbfun;
        return prevcbfun
    }
    ,
    setWindowCloseCallback: (winid,cbfun)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return null;
        var prevcbfun = win.windowCloseFunc;
        win.windowCloseFunc = cbfun;
        return prevcbfun
    }
    ,
    setWindowRefreshCallback: (winid,cbfun)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return null;
        var prevcbfun = win.windowRefreshFunc;
        win.windowRefreshFunc = cbfun;
        return prevcbfun
    }
    ,
    onClickRequestPointerLock: e=>{
        if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
            Module["canvas"].requestPointerLock();
            e.preventDefault()
        }
    }
    ,
    setInputMode: (winid,mode,value)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return;
        switch (mode) {
        case 208897:
            {
                switch (value) {
                case 212993:
                    {
                        win.inputModes[mode] = value;
                        Module["canvas"].removeEventListener("click", GLFW.onClickRequestPointerLock, true);
                        Module["canvas"].exitPointerLock();
                        break
                    }
                case 212994:
                    {
                        err("glfwSetInputMode called with GLFW_CURSOR_HIDDEN value not implemented");
                        break
                    }
                case 212995:
                    {
                        win.inputModes[mode] = value;
                        Module["canvas"].addEventListener("click", GLFW.onClickRequestPointerLock, true);
                        Module["canvas"].requestPointerLock();
                        break
                    }
                default:
                    {
                        err(`glfwSetInputMode called with unknown value parameter value: ${value}`);
                        break
                    }
                }
                break
            }
        case 208898:
            {
                err("glfwSetInputMode called with GLFW_STICKY_KEYS mode not implemented");
                break
            }
        case 208899:
            {
                err("glfwSetInputMode called with GLFW_STICKY_MOUSE_BUTTONS mode not implemented");
                break
            }
        case 208900:
            {
                err("glfwSetInputMode called with GLFW_LOCK_KEY_MODS mode not implemented");
                break
            }
        case 3342341:
            {
                err("glfwSetInputMode called with GLFW_RAW_MOUSE_MOTION mode not implemented");
                break
            }
        default:
            {
                err(`glfwSetInputMode called with unknown mode parameter value: ${mode}`);
                break
            }
        }
    }
    ,
    getKey: (winid,key)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return 0;
        return win.keys[key]
    }
    ,
    getMouseButton: (winid,button)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return 0;
        return (win.buttons & 1 << button) > 0
    }
    ,
    getCursorPos: (winid,x,y)=>{
        HEAPF64[x >> 3] = Browser.mouseX;
        HEAPF64[y >> 3] = Browser.mouseY
    }
    ,
    getMousePos: (winid,x,y)=>{
        HEAP32[x >> 2] = Browser.mouseX;
        HEAP32[y >> 2] = Browser.mouseY
    }
    ,
    setCursorPos: (winid,x,y)=>{}
    ,
    getWindowPos: (winid,x,y)=>{
        var wx = 0;
        var wy = 0;
        var win = GLFW.WindowFromId(winid);
        if (win) {
            wx = win.x;
            wy = win.y
        }
        if (x) {
            HEAP32[x >> 2] = wx
        }
        if (y) {
            HEAP32[y >> 2] = wy
        }
    }
    ,
    setWindowPos: (winid,x,y)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return;
        win.x = x;
        win.y = y
    }
    ,
    getWindowSize: (winid,width,height)=>{
        var ww = 0;
        var wh = 0;
        var win = GLFW.WindowFromId(winid);
        if (win) {
            ww = win.width;
            wh = win.height
        }
        if (width) {
            HEAP32[width >> 2] = ww
        }
        if (height) {
            HEAP32[height >> 2] = wh
        }
    }
    ,
    setWindowSize: (winid,width,height)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return;
        if (GLFW.active.id == win.id) {
            Browser.setCanvasSize(width, height)
        }
    }
    ,
    defaultWindowHints: ()=>{
        GLFW.hints = Object.assign({}, GLFW.defaultHints)
    }
    ,
    createWindow: (width,height,title,monitor,share)=>{
        var i, id;
        for (i = 0; i < GLFW.windows.length && GLFW.windows[i] !== null; i++) {}
        if (i > 0)
            throw "glfwCreateWindow only supports one window at time currently";
        id = i + 1;
        if (width <= 0 || height <= 0)
            return 0;
        if (monitor) {
            Browser.requestFullscreen()
        } else {
            Browser.setCanvasSize(width, height)
        }
        for (i = 0; i < GLFW.windows.length && GLFW.windows[i] == null; i++) {}
        var useWebGL = GLFW.hints[139265] > 0;
        if (i == GLFW.windows.length) {
            if (useWebGL) {
                var contextAttributes = {
                    antialias: GLFW.hints[135181] > 1,
                    depth: GLFW.hints[135173] > 0,
                    stencil: GLFW.hints[135174] > 0,
                    alpha: GLFW.hints[135172] > 0
                };
                Module.ctx = Browser.createContext(Module["canvas"], true, true, contextAttributes)
            } else {
                Browser.init()
            }
        }
        if (!Module.ctx && useWebGL)
            return 0;
        const canvas = Module["canvas"];
        var win = new GLFW_Window(id,canvas.clientWidth,canvas.clientHeight,canvas.width,canvas.height,title,monitor,share);
        if (id - 1 == GLFW.windows.length) {
            GLFW.windows.push(win)
        } else {
            GLFW.windows[id - 1] = win
        }
        GLFW.active = win;
        GLFW.adjustCanvasDimensions();
        return win.id
    }
    ,
    destroyWindow: winid=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return;
        if (win.windowCloseFunc) {
            getWasmTableEntry(win.windowCloseFunc)(win.id)
        }
        GLFW.windows[win.id - 1] = null;
        if (GLFW.active.id == win.id)
            GLFW.active = null;
        for (var i = 0; i < GLFW.windows.length; i++)
            if (GLFW.windows[i] !== null)
                return;
        delete Module.ctx
    }
    ,
    swapBuffers: winid=>{}
    ,
    requestFullscreen(lockPointer, resizeCanvas) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        if (typeof Browser.lockPointer == "undefined")
            Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas == "undefined")
            Browser.resizeCanvas = false;
        var canvas = Module["canvas"];
        function fullscreenChange() {
            Browser.isFullscreen = false;
            var canvasContainer = canvas.parentNode;
            if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
                canvas.exitFullscreen = Browser.exitFullscreen;
                if (Browser.lockPointer)
                    canvas.requestPointerLock();
                Browser.isFullscreen = true;
                if (Browser.resizeCanvas) {
                    Browser.setFullscreenCanvasSize()
                } else {
                    Browser.updateCanvasDimensions(canvas);
                    Browser.updateResizeListeners()
                }
            } else {
                canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
                canvasContainer.parentNode.removeChild(canvasContainer);
                if (Browser.resizeCanvas) {
                    Browser.setWindowedCanvasSize()
                } else {
                    Browser.updateCanvasDimensions(canvas);
                    Browser.updateResizeListeners()
                }
            }
            Module["onFullScreen"]?.(Browser.isFullscreen);
            Module["onFullscreen"]?.(Browser.isFullscreen)
        }
        if (!Browser.fullscreenHandlersInstalled) {
            Browser.fullscreenHandlersInstalled = true;
            document.addEventListener("fullscreenchange", fullscreenChange, false);
            document.addEventListener("mozfullscreenchange", fullscreenChange, false);
            document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
            document.addEventListener("MSFullscreenChange", fullscreenChange, false)
        }
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
        canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? ()=>canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"]) : null) || (canvasContainer["webkitRequestFullScreen"] ? ()=>canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]) : null);
        canvasContainer.requestFullscreen()
    },
    updateCanvasDimensions(canvas, wNative, hNative) {
        const scale = GLFW.getHiDPIScale();
        if (wNative && hNative) {
            canvas.widthNative = wNative;
            canvas.heightNative = hNative
        } else {
            wNative = canvas.widthNative;
            hNative = canvas.heightNative
        }
        var w = wNative;
        var h = hNative;
        if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
            if (w / h < Module["forcedAspectRatio"]) {
                w = Math.round(h * Module["forcedAspectRatio"])
            } else {
                h = Math.round(w / Module["forcedAspectRatio"])
            }
        }
        if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
            var factor = Math.min(screen.width / w, screen.height / h);
            w = Math.round(w * factor);
            h = Math.round(h * factor)
        }
        if (Browser.resizeCanvas) {
            wNative = w;
            hNative = h
        }
        const wNativeScaled = Math.floor(wNative * scale);
        const hNativeScaled = Math.floor(hNative * scale);
        if (canvas.width != wNativeScaled)
            canvas.width = wNativeScaled;
        if (canvas.height != hNativeScaled)
            canvas.height = hNativeScaled;
        if (typeof canvas.style != "undefined") {
            if (wNativeScaled != wNative || hNativeScaled != hNative) {
                canvas.style.setProperty("width", wNative + "px", "important");
                canvas.style.setProperty("height", hNative + "px", "important")
            } else {
                canvas.style.removeProperty("width");
                canvas.style.removeProperty("height")
            }
        }
    },
    calculateMouseCoords(pageX, pageY) {
        var rect = Module["canvas"].getBoundingClientRect();
        var cw = Module["canvas"].clientWidth;
        var ch = Module["canvas"].clientHeight;
        var scrollX = typeof window.scrollX != "undefined" ? window.scrollX : window.pageXOffset;
        var scrollY = typeof window.scrollY != "undefined" ? window.scrollY : window.pageYOffset;
        var adjustedX = pageX - (scrollX + rect.left);
        var adjustedY = pageY - (scrollY + rect.top);
        adjustedX = adjustedX * (cw / rect.width);
        adjustedY = adjustedY * (ch / rect.height);
        return {
            x: adjustedX,
            y: adjustedY
        }
    },
    setWindowAttrib: (winid,attrib,value)=>{
        var win = GLFW.WindowFromId(winid);
        if (!win)
            return;
        const isHiDPIAware = GLFW.isHiDPIAware();
        win.attributes[attrib] = value;
        if (isHiDPIAware !== GLFW.isHiDPIAware())
            GLFW.adjustCanvasDimensions()
    }
    ,
    getDevicePixelRatio() {
        return typeof devicePixelRatio == "number" && devicePixelRatio || 1
    },
    isHiDPIAware() {
        if (GLFW.active)
            return GLFW.active.attributes[139276] > 0;
        else
            return false
    },
    adjustCanvasDimensions() {
        const canvas = Module["canvas"];
        Browser.updateCanvasDimensions(canvas, canvas.clientWidth, canvas.clientHeight);
        Browser.updateResizeListeners()
    },
    getHiDPIScale() {
        return GLFW.isHiDPIAware() ? GLFW.scale : 1
    },
    onDevicePixelRatioChange() {
        GLFW.onWindowContentScaleChanged(GLFW.getDevicePixelRatio());
        GLFW.adjustCanvasDimensions()
    },
    GLFW2ParamToGLFW3Param: param=>{
        var table = {
            196609: 0,
            196610: 0,
            196611: 0,
            196612: 0,
            196613: 0,
            196614: 0,
            131073: 0,
            131074: 0,
            131075: 0,
            131076: 0,
            131077: 135169,
            131078: 135170,
            131079: 135171,
            131080: 135172,
            131081: 135173,
            131082: 135174,
            131083: 135183,
            131084: 135175,
            131085: 135176,
            131086: 135177,
            131087: 135178,
            131088: 135179,
            131089: 135180,
            131090: 0,
            131091: 135181,
            131092: 139266,
            131093: 139267,
            131094: 139270,
            131095: 139271,
            131096: 139272
        };
        return table[param]
    }
};
var _glfwCreateWindow = (width,height,title,monitor,share)=>GLFW.createWindow(width, height, title, monitor, share);
var _glfwGetPrimaryMonitor = ()=>1;
var _glfwGetVideoMode = monitor=>0;
var _glfwInit = ()=>{
    if (GLFW.windows)
        return 1;
    GLFW.initialTime = GLFW.getTime();
    GLFW.defaultWindowHints();
    GLFW.windows = new Array;
    GLFW.active = null;
    GLFW.scale = GLFW.getDevicePixelRatio();
    window.addEventListener("gamepadconnected", GLFW.onGamepadConnected, true);
    window.addEventListener("gamepaddisconnected", GLFW.onGamepadDisconnected, true);
    window.addEventListener("keydown", GLFW.onKeydown, true);
    window.addEventListener("keypress", GLFW.onKeyPress, true);
    window.addEventListener("keyup", GLFW.onKeyup, true);
    window.addEventListener("blur", GLFW.onBlur, true);
    GLFW.devicePixelRatioMQL = window.matchMedia("(resolution: " + GLFW.getDevicePixelRatio() + "dppx)");
    GLFW.devicePixelRatioMQL.addEventListener("change", GLFW.onDevicePixelRatioChange);
    Module["canvas"].addEventListener("touchmove", GLFW.onMousemove, true);
    Module["canvas"].addEventListener("touchstart", GLFW.onMouseButtonDown, true);
    Module["canvas"].addEventListener("touchcancel", GLFW.onMouseButtonUp, true);
    Module["canvas"].addEventListener("touchend", GLFW.onMouseButtonUp, true);
    Module["canvas"].addEventListener("mousemove", GLFW.onMousemove, true);
    Module["canvas"].addEventListener("mousedown", GLFW.onMouseButtonDown, true);
    Module["canvas"].addEventListener("mouseup", GLFW.onMouseButtonUp, true);
    Module["canvas"].addEventListener("wheel", GLFW.onMouseWheel, true);
    Module["canvas"].addEventListener("mousewheel", GLFW.onMouseWheel, true);
    Module["canvas"].addEventListener("mouseenter", GLFW.onMouseenter, true);
    Module["canvas"].addEventListener("mouseleave", GLFW.onMouseleave, true);
    Module["canvas"].addEventListener("drop", GLFW.onDrop, true);
    Module["canvas"].addEventListener("dragover", GLFW.onDragover, true);
    Browser.requestFullscreen = GLFW.requestFullscreen;
    Browser.calculateMouseCoords = GLFW.calculateMouseCoords;
    Browser.updateCanvasDimensions = GLFW.updateCanvasDimensions;
    Browser.resizeListeners.push((width,height)=>{
        if (GLFW.isHiDPIAware()) {
            var canvas = Module["canvas"];
            GLFW.onCanvasResize(canvas.clientWidth, canvas.clientHeight, width, height)
        } else {
            GLFW.onCanvasResize(width, height, width, height)
        }
    }
    );
    return 1
}
;
var _glfwMakeContextCurrent = winid=>{}
;
var _glfwPollEvents = ()=>{}
;
var _glfwSetClipboardString = (win,string)=>{}
;
var _glfwSetDropCallback = (winid,cbfun)=>GLFW.setDropCallback(winid, cbfun);
var _glfwSetErrorCallback = cbfun=>{
    var prevcbfun = GLFW.errorFunc;
    GLFW.errorFunc = cbfun;
    return prevcbfun
}
;
var _glfwSetKeyCallback = (winid,cbfun)=>GLFW.setKeyCallback(winid, cbfun);
var _glfwSetScrollCallback = (winid,cbfun)=>GLFW.setScrollCallback(winid, cbfun);
var _glfwSetWindowSizeCallback = (winid,cbfun)=>GLFW.setWindowSizeCallback(winid, cbfun);
var _glfwSwapBuffers = winid=>GLFW.swapBuffers(winid);
var _glfwSwapInterval = interval=>{
    interval = Math.abs(interval);
    if (interval == 0)
        _emscripten_set_main_loop_timing(0, 0);
    else
        _emscripten_set_main_loop_timing(1, interval)
}
;
var _glfwTerminate = ()=>{
    window.removeEventListener("gamepadconnected", GLFW.onGamepadConnected, true);
    window.removeEventListener("gamepaddisconnected", GLFW.onGamepadDisconnected, true);
    window.removeEventListener("keydown", GLFW.onKeydown, true);
    window.removeEventListener("keypress", GLFW.onKeyPress, true);
    window.removeEventListener("keyup", GLFW.onKeyup, true);
    window.removeEventListener("blur", GLFW.onBlur, true);
    Module["canvas"].removeEventListener("touchmove", GLFW.onMousemove, true);
    Module["canvas"].removeEventListener("touchstart", GLFW.onMouseButtonDown, true);
    Module["canvas"].removeEventListener("touchcancel", GLFW.onMouseButtonUp, true);
    Module["canvas"].removeEventListener("touchend", GLFW.onMouseButtonUp, true);
    Module["canvas"].removeEventListener("mousemove", GLFW.onMousemove, true);
    Module["canvas"].removeEventListener("mousedown", GLFW.onMouseButtonDown, true);
    Module["canvas"].removeEventListener("mouseup", GLFW.onMouseButtonUp, true);
    Module["canvas"].removeEventListener("wheel", GLFW.onMouseWheel, true);
    Module["canvas"].removeEventListener("mousewheel", GLFW.onMouseWheel, true);
    Module["canvas"].removeEventListener("mouseenter", GLFW.onMouseenter, true);
    Module["canvas"].removeEventListener("mouseleave", GLFW.onMouseleave, true);
    Module["canvas"].removeEventListener("drop", GLFW.onDrop, true);
    Module["canvas"].removeEventListener("dragover", GLFW.onDragover, true);
    if (GLFW.devicePixelRatioMQL)
        GLFW.devicePixelRatioMQL.removeEventListener("change", GLFW.onDevicePixelRatioChange);
    Module["canvas"].width = Module["canvas"].height = 1;
    GLFW.windows = null;
    GLFW.active = null
}
;
var _glfwWindowHint = (target,hint)=>{
    GLFW.hints[target] = hint
}
;
var getCFunc = ident=>{
    var func = Module["_" + ident];
    return func
}
;
var writeArrayToMemory = (array,buffer)=>{
    HEAP8.set(array, buffer)
}
;
var ccall = (ident,returnType,argTypes,args,opts)=>{
    var toC = {
        string: str=>{
            var ret = 0;
            if (str !== null && str !== undefined && str !== 0) {
                ret = stringToUTF8OnStack(str)
            }
            return ret
        }
        ,
        array: arr=>{
            var ret = stackAlloc(arr.length);
            writeArrayToMemory(arr, ret);
            return ret
        }
    };
    function convertReturnValue(ret) {
        if (returnType === "string") {
            return UTF8ToString(ret)
        }
        if (returnType === "boolean")
            return Boolean(ret);
        return ret
    }
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
        for (var i = 0; i < args.length; i++) {
            var converter = toC[argTypes[i]];
            if (converter) {
                if (stack === 0)
                    stack = stackSave();
                cArgs[i] = converter(args[i])
            } else {
                cArgs[i] = args[i]
            }
        }
    }
    var ret = func(...cArgs);
    function onDone(ret) {
        if (stack !== 0)
            stackRestore(stack);
        return convertReturnValue(ret)
    }
    ret = onDone(ret);
    return ret
}
;
var cwrap = (ident,returnType,argTypes,opts)=>{
    var numericArgs = !argTypes || argTypes.every(type=>type === "number" || type === "boolean");
    var numericRet = returnType !== "string";
    if (numericRet && numericArgs && !opts) {
        return getCFunc(ident)
    }
    return (...args)=>ccall(ident, returnType, argTypes, args, opts)
}
;
var FS_createPath = FS.createPath;
var FS_unlink = path=>FS.unlink(path);
var FS_createLazyFile = FS.createLazyFile;
var FS_createDevice = FS.createDevice;
FS.createPreloadedFile = FS_createPreloadedFile;
FS.staticInit();
Module["FS_createPath"] = FS.createPath;
Module["FS_createDataFile"] = FS.createDataFile;
Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
Module["FS_unlink"] = FS.unlink;
Module["FS_createLazyFile"] = FS.createLazyFile;
Module["FS_createDevice"] = FS.createDevice;
Module["requestAnimationFrame"] = MainLoop.requestAnimationFrame;
Module["pauseMainLoop"] = MainLoop.pause;
Module["resumeMainLoop"] = MainLoop.resume;
MainLoop.init();
var miniTempWebGLFloatBuffersStorage = new Float32Array(288);
for (var i = 0; i <= 288; ++i) {
    miniTempWebGLFloatBuffers[i] = miniTempWebGLFloatBuffersStorage.subarray(0, i)
}
Module["requestFullscreen"] = Browser.requestFullscreen;
Module["setCanvasSize"] = Browser.setCanvasSize;
Module["getUserMedia"] = Browser.getUserMedia;
Module["createContext"] = Browser.createContext;
var preloadedImages = {};
var preloadedAudios = {};
var wasmImports = {
    a: ___assert_fail,
    ma: ___syscall_faccessat,
    X: ___syscall_fcntl64,
    ab: ___syscall_getdents64,
    ia: ___syscall_ioctl,
    ga: ___syscall_mkdirat,
    Y: ___syscall_openat,
    Za: ___syscall_renameat,
    _a: ___syscall_rmdir,
    Ya: ___syscall_stat64,
    $a: ___syscall_unlinkat,
    Xa: ___syscall_utimensat,
    Va: __abort_js,
    ka: __emscripten_memcpy_js,
    Ra: __localtime_js,
    Ta: __mktime_js,
    fa: __tzset_js,
    e: _emscripten_asm_const_int,
    Ga: _emscripten_cancel_main_loop,
    ja: _emscripten_date_now,
    bb: _emscripten_pause_main_loop,
    la: _emscripten_request_fullscreen_strategy,
    Wa: _emscripten_resize_heap,
    Sa: _emscripten_resume_main_loop,
    Fa: _emscripten_set_main_loop,
    ea: _exit,
    O: _fd_close,
    ha: _fd_read,
    Ua: _fd_seek,
    W: _fd_write,
    _: get_device_pixel_ratio,
    U: get_hostname,
    Aa: get_url_level_index,
    y: _glActiveTexture,
    aa: _glAttachShader,
    q: _glBindBuffer,
    n: _glBindFramebuffer,
    s: _glBindRenderbuffer,
    d: _glBindTexture,
    na: _glBlendFunc,
    w: _glBufferData,
    R: _glCheckFramebufferStatus,
    l: _glClear,
    N: _glClearColor,
    ca: _glClearStencil,
    da: _glColorMask,
    ua: _glCompileShader,
    sa: _glCreateProgram,
    wa: _glCreateShader,
    Q: _glDeleteBuffers,
    J: _glDeleteFramebuffers,
    G: _glDeleteRenderbuffers,
    M: _glDeleteTextures,
    oa: _glDepthFunc,
    g: _glDepthMask,
    c: _glDisable,
    h: _glDisableVertexAttribArray,
    t: _glDrawArrays,
    b: _glEnable,
    k: _glEnableVertexAttribArray,
    z: _glFramebufferRenderbuffer,
    S: _glFramebufferTexture2D,
    L: _glGenBuffers,
    K: _glGenFramebuffers,
    B: _glGenRenderbuffers,
    F: _glGenTextures,
    j: _glGetAttribLocation,
    p: _glGetIntegerv,
    qa: _glGetProgramInfoLog,
    $: _glGetProgramiv,
    ta: _glGetShaderInfoLog,
    ba: _glGetShaderiv,
    o: _glGetUniformLocation,
    ra: _glLinkProgram,
    Z: _glReadPixels,
    A: _glRenderbufferStorage,
    va: _glShaderSource,
    u: _glStencilFunc,
    I: _glStencilMask,
    v: _glStencilOp,
    E: _glTexImage2D,
    i: _glTexParameterf,
    C: _glTexParameteri,
    pa: _glTexSubImage2D,
    T: _glUniform1f,
    P: _glUniform1i,
    H: _glUniform2f,
    D: _glUniform3fv,
    m: _glUniformMatrix4fv,
    x: _glUseProgram,
    f: _glVertexAttribPointer,
    r: _glViewport,
    Ma: _glfwCreateWindow,
    Oa: _glfwGetPrimaryMonitor,
    Na: _glfwGetVideoMode,
    Pa: _glfwInit,
    La: _glfwMakeContextCurrent,
    ya: _glfwPollEvents,
    xa: _glfwSetClipboardString,
    Ia: _glfwSetDropCallback,
    Qa: _glfwSetErrorCallback,
    Ka: _glfwSetKeyCallback,
    Ja: _glfwSetScrollCallback,
    Ha: _glfwSetWindowSizeCallback,
    za: _glfwSwapBuffers,
    Ea: _glfwSwapInterval,
    Da: _glfwTerminate,
    V: _glfwWindowHint,
    Ca: is_daily_reward_possible,
    Ba: is_latest_browser_tab,
    cb: set_latest_browser_tab
};
var wasmExports = createWasm();
var ___wasm_call_ctors = ()=>(___wasm_call_ctors = wasmExports["eb"])();
var _free = Module["_free"] = a0=>(_free = Module["_free"] = wasmExports["fb"])(a0);
var _malloc = Module["_malloc"] = a0=>(_malloc = Module["_malloc"] = wasmExports["gb"])(a0);
var _app_webview_message = Module["_app_webview_message"] = a0=>(_app_webview_message = Module["_app_webview_message"] = wasmExports["hb"])(a0);
var _app_pause = Module["_app_pause"] = ()=>(_app_pause = Module["_app_pause"] = wasmExports["ib"])();
var _app_resume = Module["_app_resume"] = ()=>(_app_resume = Module["_app_resume"] = wasmExports["jb"])();
var _app_on_signin = Module["_app_on_signin"] = (a0,a1,a2,a3,a4,a5)=>(_app_on_signin = Module["_app_on_signin"] = wasmExports["kb"])(a0, a1, a2, a3, a4, a5);
var _app_on_signout = Module["_app_on_signout"] = ()=>(_app_on_signout = Module["_app_on_signout"] = wasmExports["lb"])();
var _app_error_ts = Module["_app_error_ts"] = (a0,a1)=>(_app_error_ts = Module["_app_error_ts"] = wasmExports["mb"])(a0, a1);
var _notification_show_inapp = Module["_notification_show_inapp"] = (a0,a1)=>(_notification_show_inapp = Module["_notification_show_inapp"] = wasmExports["nb"])(a0, a1);
var _app_set_opengl_context_lost = Module["_app_set_opengl_context_lost"] = a0=>(_app_set_opengl_context_lost = Module["_app_set_opengl_context_lost"] = wasmExports["ob"])(a0);
var _opengl_resume = Module["_opengl_resume"] = ()=>(_opengl_resume = Module["_opengl_resume"] = wasmExports["pb"])();
var _app_init = Module["_app_init"] = ()=>(_app_init = Module["_app_init"] = wasmExports["qb"])();
var _webaudio_fill = Module["_webaudio_fill"] = ()=>(_webaudio_fill = Module["_webaudio_fill"] = wasmExports["sb"])();
var _get_app_version = Module["_get_app_version"] = ()=>(_get_app_version = Module["_get_app_version"] = wasmExports["tb"])();
var _use_test_api_server = Module["_use_test_api_server"] = ()=>(_use_test_api_server = Module["_use_test_api_server"] = wasmExports["ub"])();
var _level_select_menu_start_level = Module["_level_select_menu_start_level"] = a0=>(_level_select_menu_start_level = Module["_level_select_menu_start_level"] = wasmExports["vb"])(a0);
var _set_game_focus = Module["_set_game_focus"] = a0=>(_set_game_focus = Module["_set_game_focus"] = wasmExports["wb"])(a0);
var _set_ad_freq = Module["_set_ad_freq"] = a0=>(_set_ad_freq = Module["_set_ad_freq"] = wasmExports["xb"])(a0);
var _set_ad_duration_offline = Module["_set_ad_duration_offline"] = a0=>(_set_ad_duration_offline = Module["_set_ad_duration_offline"] = wasmExports["yb"])(a0);
var _set_abtest_in_game_get = Module["_set_abtest_in_game_get"] = a0=>(_set_abtest_in_game_get = Module["_set_abtest_in_game_get"] = wasmExports["zb"])(a0);
var _set_user_premium_ends = Module["_set_user_premium_ends"] = a0=>(_set_user_premium_ends = Module["_set_user_premium_ends"] = wasmExports["Ab"])(a0);
var _get_user_premium_ends = Module["_get_user_premium_ends"] = ()=>(_get_user_premium_ends = Module["_get_user_premium_ends"] = wasmExports["Bb"])();
var _set_user_banned = Module["_set_user_banned"] = a0=>(_set_user_banned = Module["_set_user_banned"] = wasmExports["Cb"])(a0);
var _set_user_gems = Module["_set_user_gems"] = a0=>(_set_user_gems = Module["_set_user_gems"] = wasmExports["Db"])(a0);
var _set_user_nick = Module["_set_user_nick"] = a0=>(_set_user_nick = Module["_set_user_nick"] = wasmExports["Eb"])(a0);
var _set_user_state = Module["_set_user_state"] = a0=>(_set_user_state = Module["_set_user_state"] = wasmExports["Fb"])(a0);
var _set_user_uid = Module["_set_user_uid"] = a0=>(_set_user_uid = Module["_set_user_uid"] = wasmExports["Gb"])(a0);
var _set_user_adfree_ends = Module["_set_user_adfree_ends"] = a0=>(_set_user_adfree_ends = Module["_set_user_adfree_ends"] = wasmExports["Hb"])(a0);
var _get_app_inited = Module["_get_app_inited"] = ()=>(_get_app_inited = Module["_get_app_inited"] = wasmExports["Ib"])();
var _log_simple = Module["_log_simple"] = a0=>(_log_simple = Module["_log_simple"] = wasmExports["Jb"])(a0);
var _app_terminate_if_necessary = Module["_app_terminate_if_necessary"] = ()=>(_app_terminate_if_necessary = Module["_app_terminate_if_necessary"] = wasmExports["Kb"])();
var _score_set_top_nicks_and_scores = Module["_score_set_top_nicks_and_scores"] = (a0,a1,a2,a3,a4,a5,a6,a7,a8,a9)=>(_score_set_top_nicks_and_scores = Module["_score_set_top_nicks_and_scores"] = wasmExports["Lb"])(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9);
var _score_set_above_nicks_and_scores = Module["_score_set_above_nicks_and_scores"] = (a0,a1,a2,a3,a4,a5,a6,a7)=>(_score_set_above_nicks_and_scores = Module["_score_set_above_nicks_and_scores"] = wasmExports["Mb"])(a0, a1, a2, a3, a4, a5, a6, a7);
var _score_set_below_nicks_and_scores = Module["_score_set_below_nicks_and_scores"] = (a0,a1,a2,a3)=>(_score_set_below_nicks_and_scores = Module["_score_set_below_nicks_and_scores"] = wasmExports["Nb"])(a0, a1, a2, a3);
var _score_read_finished_em = Module["_score_read_finished_em"] = (a0,a1,a2,a3,a4,a5)=>(_score_read_finished_em = Module["_score_read_finished_em"] = wasmExports["Ob"])(a0, a1, a2, a3, a4, a5);
var _state_menu_payout_stop = Module["_state_menu_payout_stop"] = a0=>(_state_menu_payout_stop = Module["_state_menu_payout_stop"] = wasmExports["Pb"])(a0);
var _keydown_browser = Module["_keydown_browser"] = a0=>(_keydown_browser = Module["_keydown_browser"] = wasmExports["Qb"])(a0);
var _update_screen_size = Module["_update_screen_size"] = (a0,a1,a2)=>(_update_screen_size = Module["_update_screen_size"] = wasmExports["Rb"])(a0, a1, a2);
var _touch_start = Module["_touch_start"] = a0=>(_touch_start = Module["_touch_start"] = wasmExports["Sb"])(a0);
var _touch_move = Module["_touch_move"] = (a0,a1,a2)=>(_touch_move = Module["_touch_move"] = wasmExports["Tb"])(a0, a1, a2);
var _touch_end = Module["_touch_end"] = a0=>(_touch_end = Module["_touch_end"] = wasmExports["Ub"])(a0);
var _mouse_move = Module["_mouse_move"] = (a0,a1,a2)=>(_mouse_move = Module["_mouse_move"] = wasmExports["Vb"])(a0, a1, a2);
var _mouse_updown = Module["_mouse_updown"] = (a0,a1,a2,a3)=>(_mouse_updown = Module["_mouse_updown"] = wasmExports["Wb"])(a0, a1, a2, a3);
var _request_fullscreen = Module["_request_fullscreen"] = ()=>(_request_fullscreen = Module["_request_fullscreen"] = wasmExports["Xb"])();
var _user_accepted_and_clicked = Module["_user_accepted_and_clicked"] = ()=>(_user_accepted_and_clicked = Module["_user_accepted_and_clicked"] = wasmExports["Yb"])();
var _pause_main_loop = Module["_pause_main_loop"] = ()=>(_pause_main_loop = Module["_pause_main_loop"] = wasmExports["Zb"])();
var _resume_main_loop = Module["_resume_main_loop"] = ()=>(_resume_main_loop = Module["_resume_main_loop"] = wasmExports["_b"])();
var _main = Module["_main"] = (a0,a1)=>(_main = Module["_main"] = wasmExports["$b"])(a0, a1);
var _game_download_finished = Module["_game_download_finished"] = (a0,a1,a2)=>(_game_download_finished = Module["_game_download_finished"] = wasmExports["ac"])(a0, a1, a2);
var _play_counter_falloff = Module["_play_counter_falloff"] = a0=>(_play_counter_falloff = Module["_play_counter_falloff"] = wasmExports["bc"])(a0);
var _storage_write = Module["_storage_write"] = (a0,a1,a2)=>(_storage_write = Module["_storage_write"] = wasmExports["cc"])(a0, a1, a2);
var _ad_on_inited = Module["_ad_on_inited"] = ()=>(_ad_on_inited = Module["_ad_on_inited"] = wasmExports["dc"])();
var _ad_interstitial_on_showed = Module["_ad_interstitial_on_showed"] = a0=>(_ad_interstitial_on_showed = Module["_ad_interstitial_on_showed"] = wasmExports["ec"])(a0);
var _ad_rewarded_on_rewarded = Module["_ad_rewarded_on_rewarded"] = ()=>(_ad_rewarded_on_rewarded = Module["_ad_rewarded_on_rewarded"] = wasmExports["fc"])();
var _ad_rewarded_on_showed = Module["_ad_rewarded_on_showed"] = a0=>(_ad_rewarded_on_showed = Module["_ad_rewarded_on_showed"] = wasmExports["gc"])(a0);
var _hint_file_exists = Module["_hint_file_exists"] = a0=>(_hint_file_exists = Module["_hint_file_exists"] = wasmExports["hc"])(a0);
var _menu_query_games_add_result = Module["_menu_query_games_add_result"] = (a0,a1,a2,a3)=>(_menu_query_games_add_result = Module["_menu_query_games_add_result"] = wasmExports["ic"])(a0, a1, a2, a3);
var _menu_query_games_finished = Module["_menu_query_games_finished"] = ()=>(_menu_query_games_finished = Module["_menu_query_games_finished"] = wasmExports["jc"])();
var _menu_read_game_finished = Module["_menu_read_game_finished"] = (a0,a1,a2,a3,a4,a5)=>(_menu_read_game_finished = Module["_menu_read_game_finished"] = wasmExports["kc"])(a0, a1, a2, a3, a4, a5);
var _menu_read_counts_finished = Module["_menu_read_counts_finished"] = (a0,a1,a2,a3)=>(_menu_read_counts_finished = Module["_menu_read_counts_finished"] = wasmExports["lc"])(a0, a1, a2, a3);
var _menu_read_ledger_finished = Module["_menu_read_ledger_finished"] = (a0,a1,a2,a3,a4,a5)=>(_menu_read_ledger_finished = Module["_menu_read_ledger_finished"] = wasmExports["mc"])(a0, a1, a2, a3, a4, a5);
var _menu_write_ledger_finished = Module["_menu_write_ledger_finished"] = (a0,a1,a2)=>(_menu_write_ledger_finished = Module["_menu_write_ledger_finished"] = wasmExports["nc"])(a0, a1, a2);
var _menu_read_gems_finished = Module["_menu_read_gems_finished"] = a0=>(_menu_read_gems_finished = Module["_menu_read_gems_finished"] = wasmExports["oc"])(a0);
var _state_menu_deeplink_stop = Module["_state_menu_deeplink_stop"] = (a0,a1)=>(_state_menu_deeplink_stop = Module["_state_menu_deeplink_stop"] = wasmExports["pc"])(a0, a1);
var _menu_file_upload_finished = Module["_menu_file_upload_finished"] = a0=>(_menu_file_upload_finished = Module["_menu_file_upload_finished"] = wasmExports["qc"])(a0);
var _share_file_finished = Module["_share_file_finished"] = a0=>(_share_file_finished = Module["_share_file_finished"] = wasmExports["rc"])(a0);
var _iap_cancelled = Module["_iap_cancelled"] = ()=>(_iap_cancelled = Module["_iap_cancelled"] = wasmExports["sc"])();
var _state_menu_payout_add = Module["_state_menu_payout_add"] = (a0,a1,a2)=>(_state_menu_payout_add = Module["_state_menu_payout_add"] = wasmExports["tc"])(a0, a1, a2);
var _menu_on_password_reset_email_sent = Module["_menu_on_password_reset_email_sent"] = ()=>(_menu_on_password_reset_email_sent = Module["_menu_on_password_reset_email_sent"] = wasmExports["uc"])();
var _menu_sync_upload_finished = Module["_menu_sync_upload_finished"] = ()=>(_menu_sync_upload_finished = Module["_menu_sync_upload_finished"] = wasmExports["vc"])();
var _menu_sync_download_finished = Module["_menu_sync_download_finished"] = ()=>(_menu_sync_download_finished = Module["_menu_sync_download_finished"] = wasmExports["wc"])();
var _moderation_publish_perform = Module["_moderation_publish_perform"] = ()=>(_moderation_publish_perform = Module["_moderation_publish_perform"] = wasmExports["xc"])();
var _web_command_fetch_url_done = Module["_web_command_fetch_url_done"] = (a0,a1)=>(_web_command_fetch_url_done = Module["_web_command_fetch_url_done"] = wasmExports["yc"])(a0, a1);
var _set_is_mobile = Module["_set_is_mobile"] = a0=>(_set_is_mobile = Module["_set_is_mobile"] = wasmExports["zc"])(a0);
var _ntp_set_server_time = Module["_ntp_set_server_time"] = a0=>(_ntp_set_server_time = Module["_ntp_set_server_time"] = wasmExports["Ac"])(a0);
var _news_create = Module["_news_create"] = a0=>(_news_create = Module["_news_create"] = wasmExports["Bc"])(a0);
var _news_update_started = Module["_news_update_started"] = ()=>(_news_update_started = Module["_news_update_started"] = wasmExports["Cc"])();
var _news_update_finished = Module["_news_update_finished"] = ()=>(_news_update_finished = Module["_news_update_finished"] = wasmExports["Dc"])();
var __emscripten_tempret_set = a0=>(__emscripten_tempret_set = wasmExports["Ec"])(a0);
var __emscripten_stack_restore = a0=>(__emscripten_stack_restore = wasmExports["Fc"])(a0);
var __emscripten_stack_alloc = a0=>(__emscripten_stack_alloc = wasmExports["Gc"])(a0);
var _emscripten_stack_get_current = ()=>(_emscripten_stack_get_current = wasmExports["Hc"])();
Module["addRunDependency"] = addRunDependency;
Module["removeRunDependency"] = removeRunDependency;
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;
Module["getValue"] = getValue;
Module["UTF8ToString"] = UTF8ToString;
Module["stringToUTF8"] = stringToUTF8;
Module["writeArrayToMemory"] = writeArrayToMemory;
Module["FS_createPreloadedFile"] = FS_createPreloadedFile;
Module["FS_unlink"] = FS_unlink;
Module["FS_createPath"] = FS_createPath;
Module["FS_createDevice"] = FS_createDevice;
Module["FS_createDataFile"] = FS_createDataFile;
Module["FS_createLazyFile"] = FS_createLazyFile;
var calledRun;
dependenciesFulfilled = function runCaller() {
    if (!calledRun)
        run();
    if (!calledRun)
        dependenciesFulfilled = runCaller
}
;
function callMain(args=[]) {
    var entryFunction = _main;
    args.unshift(thisProgram);
    var argc = args.length;
    var argv = stackAlloc((argc + 1) * 4);
    var argv_ptr = argv;
    args.forEach(arg=>{
        HEAPU32[argv_ptr >> 2] = stringToUTF8OnStack(arg);
        argv_ptr += 4
    }
    );
    HEAPU32[argv_ptr >> 2] = 0;
    try {
        var ret = entryFunction(argc, argv);
        exitJS(ret, true);
        return ret
    } catch (e) {
        return handleException(e)
    }
}
function run(args=arguments_) {
    if (runDependencies > 0) {
        return
    }
    preRun();
    if (runDependencies > 0) {
        return
    }
    function doRun() {
        if (calledRun)
            return;
        calledRun = true;
        Module["calledRun"] = true;
        if (ABORT)
            return;
        initRuntime();
        preMain();
        Module["onRuntimeInitialized"]?.();
        if (shouldRunNow)
            callMain(args);
        postRun()
    }
    if (Module["setStatus"]) {
        Module["setStatus"]("Running...");
        setTimeout(()=>{
            setTimeout(()=>Module["setStatus"](""), 1);
            doRun()
        }
        , 1)
    } else {
        doRun()
    }
}
if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function")
        Module["preInit"] = [Module["preInit"]];
    while (Module["preInit"].length > 0) {
        Module["preInit"].pop()()
    }
}
var shouldRunNow = true;
if (Module["noInitialRun"])
    shouldRunNow = false;
run();
