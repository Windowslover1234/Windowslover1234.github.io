(()=>{
    "use strict";
    function e() {
        var e;
        try {
            e = performance.getEntriesByType("resource").map((function(e) {
                return e.encodedBodySize
            }
            )).reduce((function(e, t) {
                return e + t
            }
            )),
            e += performance.getEntriesByType("navigation")[0].encodedBodySize
        } catch (e) {}
        return e
    }
    var t = function(e, t, n, o) {
        return new (n || (n = Promise))((function(r, i) {
            function a(e) {
                try {
                    u(o.next(e))
                } catch (e) {
                    i(e)
                }
            }
            function c(e) {
                try {
                    u(o.throw(e))
                } catch (e) {
                    i(e)
                }
            }
            function u(e) {
                var t;
                e.done ? r(e.value) : (t = e.value,
                t instanceof n ? t : new n((function(e) {
                    e(t)
                }
                ))).then(a, c)
            }
            u((o = o.apply(e, t || [])).next())
        }
        ))
    }
      , n = function(e, t) {
        var n, o, r, i = {
            label: 0,
            sent: function() {
                if (1 & r[0])
                    throw r[1];
                return r[1]
            },
            trys: [],
            ops: []
        }, a = Object.create(("function" == typeof Iterator ? Iterator : Object).prototype);
        return a.next = c(0),
        a.throw = c(1),
        a.return = c(2),
        "function" == typeof Symbol && (a[Symbol.iterator] = function() {
            return this
        }
        ),
        a;
        function c(c) {
            return function(u) {
                return function(c) {
                    if (n)
                        throw new TypeError("Generator is already executing.");
                    for (; a && (a = 0,
                    c[0] && (i = 0)),
                    i; )
                        try {
                            if (n = 1,
                            o && (r = 2 & c[0] ? o.return : c[0] ? o.throw || ((r = o.return) && r.call(o),
                            0) : o.next) && !(r = r.call(o, c[1])).done)
                                return r;
                            switch (o = 0,
                            r && (c = [2 & c[0], r.value]),
                            c[0]) {
                            case 0:
                            case 1:
                                r = c;
                                break;
                            case 4:
                                return i.label++,
                                {
                                    value: c[1],
                                    done: !1
                                };
                            case 5:
                                i.label++,
                                o = c[1],
                                c = [0];
                                continue;
                            case 7:
                                c = i.ops.pop(),
                                i.trys.pop();
                                continue;
                            default:
                                if (!(r = i.trys,
                                (r = r.length > 0 && r[r.length - 1]) || 6 !== c[0] && 2 !== c[0])) {
                                    i = 0;
                                    continue
                                }
                                if (3 === c[0] && (!r || c[1] > r[0] && c[1] < r[3])) {
                                    i.label = c[1];
                                    break
                                }
                                if (6 === c[0] && i.label < r[1]) {
                                    i.label = r[1],
                                    r = c;
                                    break
                                }
                                if (r && i.label < r[2]) {
                                    i.label = r[2],
                                    i.ops.push(c);
                                    break
                                }
                                r[2] && i.ops.pop(),
                                i.trys.pop();
                                continue
                            }
                            c = t.call(e, i)
                        } catch (e) {
                            c = [6, e],
                            o = 0
                        } finally {
                            n = r = 0
                        }
                    if (5 & c[0])
                        throw c[1];
                    return {
                        value: c[0] ? c[1] : void 0,
                        done: !0
                    }
                }([c, u])
            }
        }
    }
      , o = function(e) {
        var t = RegExp("[?&]".concat(e, "=([^&]*)")).exec(window.location.search);
        return t && decodeURIComponent(t[1].replace(/\+/g, " "))
    }
      , r = "kids" === o("tag")
      , i = !!window.adBridge
      , a = "yes" === o("hoist") || "yes" === o("gdhoist")
      , c = new (function() {
        function e() {
            var e = this;
            this.queue = [],
            this.init = function(t, n) {
                return void 0 === t && (t = {}),
                void 0 === n && (n = {}),
                new Promise((function(o, r) {
                    e.enqueue("init", [t, n], o, r)
                }
                ))
            }
            ,
            this.rewardedBreak = function() {
                return new Promise((function(e) {
                    e(!1)
                }
                ))
            }
            ,
            this.commercialBreak = function(t) {
                return new Promise((function(n, o) {
                    e.enqueue("commercialBreak", [t], n, o)
                }
                ))
            }
            ,
            this.displayAd = function(e, t, n, o) {
                o && o(!0),
                n && n()
            }
            ,
            this.withArguments = function(t) {
                return function() {
                    for (var n = [], o = 0; o < arguments.length; o++)
                        n[o] = arguments[o];
                    e.enqueue(t, n)
                }
            }
            ,
            this.handleAutoResolvePromise = function() {
                return new Promise((function(e) {
                    e()
                }
                ))
            }
            ,
            this.throwNotLoaded = function() {
                console.debug("PokiSDK is not loaded yet. Not all methods are available.")
            }
            ,
            this.doNothing = function() {}
            ,
            this.getUser = function() {
                return t(e, void 0, void 0, (function() {
                    var e = this;
                    return n(this, (function(t) {
                        return [2, new Promise((function(t, n) {
                            e.enqueue("getUser", [], t, n)
                        }
                        ))]
                    }
                    ))
                }
                ))
            }
            ,
            this.login = function() {
                return t(e, void 0, void 0, (function() {
                    var e = this;
                    return n(this, (function(t) {
                        return [2, new Promise((function(t, n) {
                            e.enqueue("login", [], t, n)
                        }
                        ))]
                    }
                    ))
                }
                ))
            }
        }
        return e.prototype.enqueue = function(e, t, n, o) {
            var i = {
                fn: e,
                args: t || [],
                resolveFn: n,
                rejectFn: o
            };
            r ? n && n(!0) : this.queue.push(i)
        }
        ,
        e.prototype.dequeue = function() {
            for (var e = this, t = function() {
                var t, o, r = n.queue.shift(), i = r, a = i.fn, c = i.args;
                if ("function" == typeof window.PokiSDK[a])
                    if ((null == r ? void 0 : r.resolveFn) || (null == r ? void 0 : r.rejectFn)) {
                        var u = "init" === a;
                        if ((t = window.PokiSDK)[a].apply(t, c).catch((function() {
                            for (var t = [], n = 0; n < arguments.length; n++)
                                t[n] = arguments[n];
                            "function" == typeof r.rejectFn && r.rejectFn.apply(r, t),
                            u && setTimeout((function() {
                                e.dequeue()
                            }
                            ), 0)
                        }
                        )).then((function() {
                            for (var t = [], n = 0; n < arguments.length; n++)
                                t[n] = arguments[n];
                            "function" == typeof r.resolveFn && r.resolveFn.apply(r, t),
                            u && setTimeout((function() {
                                e.dequeue()
                            }
                            ), 0)
                        }
                        )),
                        u)
                            return "break"
                    } else
                        (o = window.PokiSDK)[a].apply(o, c);
                else
                    console.error("%cPOKI:%c cannot execute ".concat(a), "font-weight: bold", "")
            }, n = this; this.queue.length > 0; ) {
                if ("break" === t())
                    break
            }
        }
        ,
        e
    }());
    if (window.PokiSDK = {
        init: c.init,
        initWithVideoHB: c.init,
        commercialBreak: c.commercialBreak,
        rewardedBreak: c.rewardedBreak,
        displayAd: c.displayAd,
        destroyAd: c.doNothing,
        getLeaderboard: c.handleAutoResolvePromise,
        shareableURL: function() {
            return new Promise((function(e, t) {
                t()
            }
            ))
        },
        getURLParam: function(e) {
            return o("gd".concat(e)) || o(e) || ""
        },
        getLanguage: function() {
            return navigator.language.toLowerCase().split("-")[0]
        },
        isAdBlocked: function() {}
    },
    ["captureError", "customEvent", "gameInteractive", "gameLoadingFinished", "gameLoadingProgress", "gameLoadingStart", "gameplayStart", "gameplayStop", "happyTime", "logError", "muteAd", "roundEnd", "roundStart", "sendHighscore", "setDebug", "setDebugTouchOverlayController", "setLogging", "setPlayerAge", "setPlaytestCanvas", "enableEventTracking", "playtestSetCanvas", "playtestCaptureHtmlOnce", "playtestCaptureHtmlForce", "playtestCaptureHtmlOn", "playtestCaptureHtmlOff"].forEach((function(e) {
        window.PokiSDK[e] = c.withArguments(e)
    }
    )),
    !i && !r) {
        window.pokiCancelProgressInterval = setInterval((function() {
            window.parent.postMessage({
                type: "pokiProgress",
                downloaded: e()
            }, "*")
        }
        ), 1e3);
        try {
            var u = localStorage.getItem("poki_events_user_id");
            u || (u = crypto.randomUUID(),
            "GB" !== o("country") && localStorage.setItem("poki_events_user_id", u));
            var s = o("game_id")
              , l = o("game_version_id");
            if (!s || !l)
                throw 1;
            var d = "1" === localStorage.getItem("poki_pbf")
              , f = function(e) {
                return /^[-+]?\d+$/.test(e.trim())
            };
            window.PokiSDK.measure = function(e, t, n) {
                "level" === (e = "".concat(e)) && (e = "progress"),
                function(e, t, n) {
                    return "game" === e && "loading" === t && "start" === n || "game" === e && "loading" === t && "complete" === n || "game" === e && "launch" === t && "" === n || "game" === e && "meaningful" === t && "first" === n || "tutorial" === e && "start" === t && "" === n || "tutorial" === e && "complete" === t && "" === n || !("progress" !== e || "start" !== t || !f(n)) || !("progress" !== e || "complete" !== t || !f(n)) || !("progress" !== e || "fail" !== t || !f(n)) || "rewarded" === e && "visible" === t || "rewarded" === e && "click" === t || !("rewarded" !== e || "start" !== t || !f(n)) || !("rewarded" !== e || "complete" !== t || !f(n)) || !("midroll" !== e || "start" !== t || !f(n)) || !("midroll" !== e || "complete" !== t || !f(n)) || "custom" === e
                }(e, t = void 0 === t ? "" : "".concat(t), n = void 0 === n ? "" : "".concat(n)) ? (window.pokiMeasureBuildin = !0,
                fetch("https://t.poki.io/game-event", {
                    method: "POST",
                    headers: {
                        "Content-Type": "text/plain"
                    },
                    body: JSON.stringify({
                        category: e,
                        action: t,
                        label: n,
                        p4d_game_id: s,
                        p4d_version_id: l,
                        time_on_page: Math.floor(performance.now()),
                        user_id: u,
                        user_new: !d
                    }),
                    mode: "no-cors",
                    keepalive: !0,
                    credentials: "omit"
                }).catch((function(e) {
                    console.warn("%cPOKI:%c failed to measure", "font-weight: bold", "", e)
                }
                ))) : console.warn("%cPOKI:%c measure() event not allowed: ".concat(e, "-").concat(t, "-").concat(n), "font-weight: bold", "")
            }
            ,
            window.PokiSDK.measure("game", "loading", "start"),
            window.pokiMeasureBuildin = !1
        } catch (e) {
            window.PokiSDK.measure = function() {}
        }
    }
    var p = function() {
        var e = window.pokiSDKVersion || o("ab") || "54cfaf7bb10e29acef1b4b5dd11eeaa74dcb6036"
          , t = "poki-sdk-core-".concat(e, ".js");
        r && (t = "poki-sdk-kids-".concat(e, ".js")),
        i && (t = "poki-sdk-playground-".concat(e, ".js")),
        a && (t = "poki-sdk-hoist-".concat(e, ".js"));
        new URL(document.currentScript.src);
        return "https://windowslover1234.github.io/games/drive-mad-1.5/".concat(e, "/").concat(t)
    }()
      , g = document.createElement("script");
    g.setAttribute("src", p),
    g.setAttribute("type", "text/javascript"),
    g.setAttribute("crossOrigin", "anonymous"),
    g.onload = function() {
        return c.dequeue()
    }
    ,
    document.head.appendChild(g)
}
)();
