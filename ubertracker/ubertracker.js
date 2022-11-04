/* global cQuery */

class UberTracker {
    constructor(options) {
        const self = this;

        const defaultOptions = {
            eventPushInterval: 5000,
            apmUpdateInterval: 5000,
            speedUpdateInterval: 5000,
            pointerMoveThrottleInterval: 250,
            trackerUrl: "https://cotinker.projects.cavi.au.dk/ubertracker.php"
        };

        this.options = Object.assign({}, defaultOptions, options);

        this.moveListeners = [];
        this.actionListeners = [];
        this.apmEvents = [];
        this.events = [];

        this.clientDataResolve = null;
        this.clientDataPromise = new Promise((resolve)=>{
            self.clientDataResolve = resolve;
        });

        this.lastPointerMove = 0;

        this.sessionData = null;
        this.clientData = null;

        this.getClientSession().then((clientData)=>{
            self.clientData = clientData;

            console.log("Got client data:", self.clientData);
            self.clientDataResolve();
        });
    }

    async startTracking() {
        const self = this;

        console.log("Starting UberTracker...");

        this.setupEventListeners();
        this.setupSpeedTrackers();

        await this.clientDataPromise;

        return self.startTrackingSession().then((sessionData)=>{
            self.sessionData = sessionData;
            self.startEventPusher();
            console.log("UberTracker ready:", sessionData);
        });
    }

    startEventPusher() {
        const self = this;
        setInterval(()=>{
            self.postEvents();
        }, this.options.eventPushInterval);
    }

    async doFetch(url, data = null, json = true) {
        let fetchOptions = {
            "method": "GET",
            "credentials": "include"
        }

        if(data != null) {
            //Switch to post method, since we have data
            fetchOptions.method = "POST";

            let formData = new FormData();

            Object.keys(data).forEach((key)=>{
                let value = data[key];
                if(typeof value === "object") {
                    value = JSON.stringify(value);
                }
                formData.append(key, value);
            });

            fetchOptions.body = formData;
        }

        let response = await fetch(url, fetchOptions);

        if(response.status !== 200) {
            let error = await response.text();

            throw new Error("Error in doFetch: "+error);
        }

        let result = "";

        if(json) {
            try {
                result = await response.json();
            } catch(e) {
                console.warn("Error parsing response as json:", e);
                result = {};
            }
        } else {
            result = await response.text();
        }

        return result;
    }

    async ready() {
        return await this.clientDataPromise;
    }

    async getSubsessions() {
        await this.clientDataPromise;

        return this.doFetch(this.options.trackerUrl+"?cmd=getSubsessions", {
            session: this.clientData.session
        });
    }

    async getEventsFromSubsession(subsession, options) {
        let data = {
            subsession: subsession
        }

        if(options.types != null) {
            if(Array.isArray(options.types)) {
                data.types = options.types.join(",");
            } else {
                if(typeof options.types === "string") {
                    data.types = options.types;
                } else {
                    console.warn("Unknown options.types variant:", options.types);
                }
            }
        }

        if(options.start != null) {
            if(typeof options.start === "number") {
                data.start = options.start;
            } else if(typeof options.start === "string") {
                data.start = chrono.de.parseDate(options.start).getTime();
            } else {
                console.warn("Unknown options.start variant:", options.start);
            }
        }

        if(options.end != null) {
            if(typeof options.end === "number") {
                data.end = options.end;
            } else if(typeof options.end === "string") {
                data.end = chrono.de.parseDate(options.end).getTime();
            } else {
                console.warn("Unknown options.end variant:", options.end);
            }
        }

        return this.doFetch(this.options.trackerUrl+"?cmd=getEvents", data);
    }

    async getStatistics(subsession) {
        return this.doFetch(this.options.trackerUrl+"?cmd=getStatistics", {
            subsession: subsession
        });
    }

    async getClientSession() {
        return this.doFetch(this.options.trackerUrl+"?cmd=getClientSession");
    }

    async startTrackingSession() {
        let data = {
            url: location.href,
            time: Date.now()
        };

        return this.doFetch(this.options.trackerUrl+"?cmd=startTrackingSubsession", {
            "data": data
        });
    }

    async postEvents() {
        if(this.events.length === 0) {
            return;
        }

        let data = {
            subsession: this.sessionData.subsession,
            events: JSON.stringify(this.events)
        };

        //Reset events to empty array
        this.events = [];

        return this.doFetch(this.options.trackerUrl+"?cmd=track", data, false);
    }

    setupEventListeners() {
        const self = this;

        console.log("Setting up event listeners...");

        cQuery(window).on("focus", (evt)=>{
            self.handleWindowFocus(evt);
        });
        cQuery(window).on("blur", (evt)=>{
            self.handleWindowBlur(evt);
        });

        cQuery("body").on("focusin", (evt)=>{
            self.handleElementFocus(evt)
        });
        cQuery("body").on("focusout", (evt)=>{
            self.handleElementBlur(evt)
        });
        cQuery("body").on("click", (evt)=>{
            self.handleElementClick(evt);
        });
        cQuery("body").on("pointerdown", (evt)=>{
            self.handleElementDown(evt);
        });
        cQuery("body").on("pointerup", (evt)=>{
            self.handleElementUp(evt);
        });

        cQuery("body").on("input", (evt)=>{
            self.handleElementInput(evt);
        });

        cQuery("body").on("keyup", (evt)=>{
            self.handleElementKeyup(evt);
        });

        cQuery("body").on("keydown", (evt)=>{
            self.handleElementKeydown(evt);
        });

        cQuery("body").liveQuery("[data-tag]", {
            added: (elm)=>{
                let tags = self.getTags(elm);
                cQuery(elm).on("click", (evt)=>{
                    self.handleTaggedClick(evt, tags);
                });
                cQuery(elm).on("pointerdown", (evt)=>{
                    self.handleTaggedDown(evt, tags);
                });
                cQuery(elm).on("pointerup", (evt)=>{
                    self.handleTaggedUp(evt, tags);
                });
            },
            removed: (elm)=>{
                cQuery(elm).off("click");
                cQuery(elm).off("pointerdown");
                cQuery(elm).off("pointerup");
            }
        });

        cQuery(window).on("resize", (evt)=>{
            self.handleWindowResize(evt);
        });
        //Send fake resize event, to save initial size
        self.handleWindowResize({});

        cQuery(window).on("pointermove", (evt)=>{
            self.handleMove(evt);
        });
    }

    getTags(taggedElm) {
        let tagsAttr = taggedElm.getAttribute("data-tag");

        return tagsAttr.split(" ");
    }

    countAction() {
        this.actionListeners.forEach((listener)=>{
            listener();
        });
    }

    pushEvent(type, data) {
        this.events.push({
            "type": type,
            "time": Date.now(),
            "data": data
        });
    }

    handleMove(evt) {
        let pos = {
            x: evt.clientX,
            y: evt.clientY
        };

        let now = Date.now();

        if(now - this.lastPointerMove > this.options.pointerMoveThrottleInterval) {
            this.pushEvent("pointermove", pos);
            this.lastPointerMove = now;
        }

        this.moveListeners.forEach((listener)=>{
            listener(pos);
        });
    }

    handleElementKeyup(evt) {
        this.pushEvent("keyup", {
            keyCode: evt.keyCode
        });
    }

    handleElementKeydown(evt) {
        this.pushEvent("keydown", {
            keyCode: evt.keyCode
        });
    }
    handleElementInput(evt) {
        this.countAction();
        this.pushEvent("input", {
            data: evt.data,
            value: evt.target.value
        });
    }

    handleElementClick(evt) {
        this.pushEvent("click", {
            x: evt.clientX,
            y: evt.clientY
        });
    }

    handleElementDown(evt) {
        this.countAction();
        this.pushEvent("pointerdown", {
            x: evt.clientX,
            y: evt.clientY
        });
    }

    handleElementUp(evt) {
        this.pushEvent("pointerup", {
            x: evt.clientX,
            y: evt.clientY
        });
    }

    handleTaggedClick(evt, tags) {
        this.pushEvent("clicktagged", {
            x: evt.clientX,
            y: evt.clientY,
            tags: tags
        });
    }

    handleTaggedDown(evt, tags) {
        this.pushEvent("pointerdowntagged", {
            x: evt.clientX,
            y: evt.clientY,
            tags: tags
        });
    }

    handleTaggedUp(evt, tags) {
        this.pushEvent("pointeruptagged", {
            x: evt.clientX,
            y: evt.clientY,
            tags: tags
        });
    }

    handleWindowFocus(evt) {
        this.pushEvent("windowfocus", {});
    }

    handleWindowBlur(evt) {
        this.pushEvent("windowblur", {});
    }

    handleElementFocus(evt) {
        this.pushEvent("elementfocus", {});
    }

    handleElementBlur(evt) {
        this.pushEvent("elementblur", {});
    }

    handleWindowResize(evt) {
        this.pushEvent("windowresize", {
            width: window.innerWidth,
            height: window.innerHeight
        });
    }

    setupSpeedTrackers() {
        const self = this;

        console.log("Setting up speed trackers...");

        //Actions Per Minute
        let actions = 0;

        this.actionListeners.push(()=>{
            actions++;
        });

        setInterval(()=>{
            let apm = (actions / (self.options.apmUpdateInterval / 1000.0)) * 60.0;
            actions = 0;
            self.pushEvent("actionsperminute", {
                apm: apm
            });
        }, this.options.apmUpdateInterval);

        //Mouse Speed
        let avgSpeed = -1;
        let lastPos = null;
        let totalDistance = 0;
        this.moveListeners.push((pos)=>{
            if(lastPos != null) {
                //Find X,Y of movement vector
                let deltaX = Math.abs(lastPos.x - pos.x);
                let deltaY = Math.abs(lastPos.y - pos.y);

                let distance = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));

                totalDistance += distance;
            }
            lastPos = pos;
        });

        setInterval(()=>{
            let speed = totalDistance / (self.options.speedUpdateInterval / 1000.0);

            self.pushEvent("pointerspeed", {
                speed: speed
            });

            totalDistance = 0;
        }, this.options.speedUpdateInterval);
    }

    async visualizeSubsession(subsession, options = {}) {
        if(options.canvas === true) {
            await this.visualizeSubsessionCanvas(subsession, options);
        } else {
            await this.visualizeSubsessionSvg(subsession, options);
        }
    }

    async visualizeSubsessionSvg(subsession, options = {}) {
        let events = await this.getEventsFromSubsession(subsession, options);

        const draw = SVG().addTo("body").size(window.innerWidth, window.innerHeight);
        draw.node.style.position = "fixed";
        draw.node.style.top = "0px";
        draw.node.style.left = "0px";
        draw.node.style.width = window.innerWidth+"px";
        draw.node.style.height = window.innerHeight+"px";

        let lastPositionX = null;
        let lastPositionY = null;
        let timestampLastPosition = null;

        let pointerIsDown = false;

        const defaultDrawOptions = {
            move: {
                color: "black",
                timeFactor: 2
            },
            drag:{
                color: "gold"
            },
            click: {
                color: "red",
                size: 10
            },
            up: {
                color: "blue",
                size: 5
            },
            down: {
                color: "green",
                size: 7
            }
        }

        Object.keys(defaultDrawOptions).forEach((key)=>{
            let defaultOptions = defaultDrawOptions[key];

            if(options[key] !== false) {
                options[key] = Object.assign({}, defaultOptions, options[key]);
            }
        })

        function drawPath(x, y, time, color, timeFactor) {
            let arcRadius = 0;

            if(timestampLastPosition != null) {
                draw.line(lastPositionX, lastPositionY, x, y).stroke({width: 1, color: color});

                let timeDiffSeconds = (time - timestampLastPosition) / 1000.0;
                arcRadius += timeDiffSeconds * timeFactor;
            }

            let circle = draw.circle(arcRadius*2);
            circle.center(x,y);
            circle.fill({color: color}).stroke({color: color, width: 1});

            console.log(circle, arcRadius);

            lastPositionX = x;
            lastPositionY = y;
            timestampLastPosition = time;
        }

        function drawCircle(x,y, color, size) {
            let circle = draw.circle(size*2);
            circle.center(x,y);
            circle.fill("none").stroke({width: 1, color: color});
        }

        //Draw pointer path
        events.forEach((event)=>{
            switch(event.type) {
                case "pointermove":
                    if(options.move !== false) {
                        drawPath(event.data.x, event.data.y, event.time, pointerIsDown?options.drag.color:options.move.color, options.move.timeFactor);
                    }

                    break;

                case "click":
                    if(options.move !== false) {
                        drawPath(event.data.x, event.data.y, event.time, options.move.color, options.move.timeFactor);
                    }

                    if(options.click !== false) {
                        drawCircle(event.data.x, event.data.y, options.click.color, options.click.size);
                    }

                    break;

                case "pointerdown":
                    if(options.move !== false) {
                        drawPath(event.data.x, event.data.y, event.time, options.move.color, options.move.timeFactor);
                    }

                    if(options.down !== false) {
                        drawCircle(event.data.x, event.data.y, options.down.color, options.down.size);
                    }

                    pointerIsDown = true;

                    break;

                case "pointerup":
                    if(options.move !== false) {
                        drawPath(event.data.x, event.data.y, event.time, pointerIsDown?options.drag.color:options.move.color, options.move.timeFactor);
                    }

                    if(options.up !== false) {
                        drawCircle(event.data.x, event.data.y, options.up.color, options.up.size);
                    }

                    pointerIsDown = false;

                    break;

                default:
            }
        });
    }

    async visualizeSubsessionCanvas(subsession, options = {}) {
        let events = await this.getEventsFromSubsession(subsession, options);

        let canvas = document.createElement("canvas");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        document.body.appendChild(canvas);
        canvas.style.position = "fixed";
        canvas.style.top = "0px";
        canvas.style.left = "0px";
        canvas.style.width = window.innerWidth+"px";
        canvas.style.height = window.innerHeight+"px";
        
        let ctx = canvas.getContext("2d");

        let lastPositionX = null;
        let lastPositionY = null;
        let timestampLastPosition = null;

        let pointerIsDown = false;

        const defaultDrawOptions = {
            move: {
                color: "black",
                timeFactor: 2
            },
            drag:{
                color: "gold"
            },
            click: {
                color: "red",
                size: 10
            },
            up: {
                color: "blue",
                size: 5
            },
            down: {
                color: "green",
                size: 7
            }
        }

        Object.keys(defaultDrawOptions).forEach((key)=>{
            let defaultOptions = defaultDrawOptions[key];

            if(options[key] !== false) {
                options[key] = Object.assign({}, defaultOptions, options[key]);
            }
        })

        function drawPath(x, y, time, color, timeFactor) {
            ctx.fillStyle = color;
            ctx.strokeStyle = color;

            let arcRadius = 0;

            if(timestampLastPosition == null) {
                //First event, jump cursor
                ctx.moveTo(x, y);
            } else {
                //Draw line from old point to here
                ctx.beginPath();
                ctx.moveTo(lastPositionX, lastPositionY);
                ctx.lineTo(x, y);
                ctx.closePath();
                ctx.stroke();
                let timeDiffSeconds = (time - timestampLastPosition) / 1000.0;

                arcRadius += timeDiffSeconds * timeFactor;
            }

            ctx.beginPath();
            ctx.arc(x, y, arcRadius, 0, 2*Math.PI);
            ctx.closePath();
            ctx.fill();

            lastPositionX = x;
            lastPositionY = y;
            timestampLastPosition = time;
        }

        function drawCircle(x,y, color, size) {
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2*Math.PI);
            ctx.closePath();
            ctx.stroke();
        }

        //Draw pointer path
        events.forEach((event)=>{
            switch(event.type) {
                case "pointermove":
                    if(options.move !== false) {
                        drawPath(event.data.x, event.data.y, event.time, pointerIsDown?options.drag.color:options.move.color, options.move.timeFactor);
                    }

                    break;

                case "click":
                    if(options.move !== false) {
                        drawPath(event.data.x, event.data.y, event.time, options.move.color, options.move.timeFactor);
                    }

                    if(options.click !== false) {
                        drawCircle(event.data.x, event.data.y, options.click.color, options.click.size);
                    }

                    break;

                case "pointerdown":
                    if(options.move !== false) {
                        drawPath(event.data.x, event.data.y, event.time, options.move.color, options.move.timeFactor);
                    }

                    if(options.down !== false) {
                        drawCircle(event.data.x, event.data.y, options.down.color, options.down.size);
                    }

                    pointerIsDown = true;

                    break;

                case "pointerup":
                    if(options.move !== false) {
                        drawPath(event.data.x, event.data.y, event.time, pointerIsDown?options.drag.color:options.move.color, options.move.timeFactor);
                    }

                    if(options.up !== false) {
                        drawCircle(event.data.x, event.data.y, options.up.color, options.up.size);
                    }

                    pointerIsDown = false;

                    break;

                default:
            }
        })
    }
}

window.UberTracker = UberTracker;
