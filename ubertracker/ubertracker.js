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
        this.events = [];

        this.clientDataResolve = null;
        this.clientDataPromise = new Promise((resolve)=>{
            self.clientDataResolve = resolve;
        });

        this.lastPointerMove = 0;

        this.sessionData = null;
        this.clientData = null;

        this.currentlyHoveredTaggedElements = new Set();

        let params = new URLSearchParams(location.search);
        let utrack = params.get("_utrack");

        this.getClientSession(utrack).then((clientData)=>{
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
            "credentials": "include",
            "keepalive": true
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

    async getSubsessions(session=false) {
        if (!session){
            await this.clientDataPromise;
            session = this.clientData.session;
        }

        return this.doFetch(this.options.trackerUrl+"?cmd=getSubsessions", {
            session: session
        });
    }

    async getEventsFromSubsession(subsession, options = {}) {
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

        if(options.tags != null) {
            if(Array.isArray(options.tags)) {
                data.tags = options.tags.join(",");
            } else {
                if(typeof options.tags === "string") {
                    data.tags = options.tags;
                } else {
                    console.warn("Unknown options.tags variant:", options.tags);
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

    async generateCrossDomainKey(domain) {
        return this.doFetch(this.options.trackerUrl+"?cmd=generateCrossDomainKey", {
            domain: domain
        });
    }

    async getClientSession(utrack = null) {
        return this.doFetch(this.options.trackerUrl+"?cmd=getClientSession", {
            key: utrack
        });
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

        window.addEventListener("focus", (evt)=>{
            self.handleWindowFocus(evt);
        });
        window.addEventListener("blur", (evt)=>{
            self.handleWindowBlur(evt);
        });

        document.body.addEventListener("focusin", (evt)=>{
            self.handleElementFocus(evt)
        }, true);
        document.body.addEventListener("focusout", (evt)=>{
            self.handleElementBlur(evt)
        }, true);
        document.body.addEventListener("click", (evt)=>{
            self.handleElementClick(evt);
        }, true);
        document.body.addEventListener("pointerdown", (evt)=>{
            self.handleElementDown(evt);
        }, true);
        document.body.addEventListener("pointerup", (evt)=>{
            self.handleElementUp(evt);
        }, true);

        document.body.addEventListener("input", (evt)=>{
            self.handleElementInput(evt);
        }, true);

        document.body.addEventListener("keyup", (evt)=>{
            self.handleElementKeyup(evt);
        }, true);

        document.body.addEventListener("keydown", (evt)=>{
            self.handleElementKeydown(evt);
        }, true);

        window.addEventListener("pointerover", (evt)=>{
            self.handlePointerOver(evt);
        }, false);

        document.addEventListener("pointerleave", (evt)=>{
            self.updateHoveredElements([]);
        }, false);

        window.addEventListener("beforeunload", (evt)=>{
            this.postEvents().then(()=>{
            });
        });

        window.addEventListener("resize", (evt)=>{
            self.handleWindowResize(evt);
        });
        //Send fake resize event, to save initial size
        self.handleWindowResize({});

        window.addEventListener("pointermove", (evt)=>{
            self.handleMove(evt);
        });
    }

    getTags(element, skipParents=false) {
        let allTags = new Set();

        if(element.getAttribute != null) {
            let tagAttr = element.getAttribute("data-tag");

            if (tagAttr != null) {
                let tagsOnElement = tagAttr.split(" ");
                tagsOnElement = tagsOnElement.filter((tag) => {
                    return tag.trim().length > 0;
                });

                tagsOnElement.forEach((tag)=>{
                    allTags.add(tag);
                })
            }
        }

        if(element.parentNode != null && !skipParents) {
            let parentTags = this.getTags(element.parentNode);

            parentTags.forEach((tag)=>{
                allTags.add(tag);
            })
        }

        return Array.from(allTags);
    }

    countAction() {
        this.actionListeners.forEach((listener)=>{
            listener();
        });
    }

    pushEvent(type, data) {
        let evt = {
            "type": type,
            "time": Date.now(),
            "data": data
        };

        this.events.push(evt);
    }

    findTaggedParents(elm) {
        let taggedElements = [];

        let tags = this.getTags(elm, true);

        if(tags.length > 0) {
            taggedElements.push(elm);
        }

        if(elm.parentElement != null) {
            let parentTaggedElements = this.findTaggedParents(elm.parentElement);

            parentTaggedElements.forEach((parent)=>{
                taggedElements.push(parent);
            })
        }

        return taggedElements;
    }

    handlePointerOver(evt) {
        let taggedElementsHovered = this.findTaggedParents(evt.target);

        this.updateHoveredElements(taggedElementsHovered);
    }

    updateHoveredElements(taggedElementsHovered) {
        const self = this;

        this.currentlyHoveredTaggedElements.forEach((elm)=>{
            elm.stillHovered = false;
        });

        taggedElementsHovered.forEach((elm)=>{
            elm.stillHovered = true;
            if(!self.currentlyHoveredTaggedElements.has(elm)) {
                self.currentlyHoveredTaggedElements.add(elm);
                let tags = self.getTags(elm);
                self.pushEvent("pointerover", {
                    tags,
                    elementTags: self.getTags(elm, true),
                    path: finder(elm)
                });
            }
        });

        let deleteElements = [];

        this.currentlyHoveredTaggedElements.forEach((elm)=>{
            if(!elm.stillHovered) {
                deleteElements.push(elm);
                let tags = self.getTags(elm);
                self.pushEvent("pointerout", {
                    tags,
                    elementTags: self.getTags(elm, true),
                    path: finder(elm)
                });
            }
        });

        deleteElements.forEach((elm)=>{
            this.currentlyHoveredTaggedElements.delete(elm);
        });
    }

    handleMove(evt) {
        let pos = {
            x: evt.pageX,
            y: evt.pageY
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
            keyCode: evt.keyCode,
            elementTags: this.getTags(evt.target, true),
            tags: this.getTags(evt.target),
            path: finder(evt.target)
        });
    }

    handleElementKeydown(evt) {
        this.pushEvent("keydown", {
            keyCode: evt.keyCode,
            elementTags: this.getTags(evt.target, true),
            tags: this.getTags(evt.target),
            path: finder(evt.target)
        });
    }
    handleElementInput(evt) {
        this.countAction();
        this.pushEvent("input", {
            data: evt.data,
            value: evt.target.value,
            elementTags: this.getTags(evt.target, true),
            tags: this.getTags(evt.target),
            path: finder(evt.target)
        });
    }

    handleElementClick(evt) {
        this.pushEvent("click", {
            x: evt.pageX,
            y: evt.pageY,
            elementTags: this.getTags(evt.target, true),
            tags: this.getTags(evt.target),
            path: finder(evt.target)
        });
    }

    handleElementDown(evt) {
        this.countAction();
        this.pushEvent("pointerdown", {
            x: evt.pageX,
            y: evt.pageY,
            elementTags: this.getTags(evt.target, true),
            tags: this.getTags(evt.target),
            path: finder(evt.target)
        });
    }

    handleElementUp(evt) {
        this.pushEvent("pointerup", {
            x: evt.pageX,
            y: evt.pageY,
            elementTags: this.getTags(evt.target, true),
            tags: this.getTags(evt.target),
            path: finder(evt.target)
        });
    }
    handleWindowFocus(evt) {
        this.pushEvent("windowfocus", {
        });
    }

    handleWindowBlur(evt) {
        this.pushEvent("windowblur", {
        });
    }

    handleElementFocus(evt) {
        this.pushEvent("elementfocus", {
            elementTags: this.getTags(evt.target, true),
            tags: this.getTags(evt.target),
            path: finder(evt.target)
        });
    }

    handleElementBlur(evt) {
        this.pushEvent("elementblur", {
            elementTags: this.getTags(evt.target, true),
            tags: this.getTags(evt.target),
            path: finder(evt.target)
        });
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

        let lastAPM = -1;
        let lastPointerSpeed = -1;

        setInterval(()=>{
            let apm = (actions / (self.options.apmUpdateInterval / 1000.0)) * 60.0;
            actions = 0;

            if(apm === 0 && lastAPM === 0) {
                //Dont send APM, if we already said 0, and new value is 0
                return;
            }

            lastAPM = apm;

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

            if(speed === 0 && lastPointerSpeed === 0) {
                //Dont send APM, if we already said 0, and new value is 0
                return;
            }

            lastPointerSpeed = speed;

            self.pushEvent("pointerspeed", {
                speed: speed
            });

            totalDistance = 0;
        }, this.options.speedUpdateInterval);
    }

    async visualizeSubsession(subsession, options = {}) {
        let events = await this.getEventsFromSubsession(subsession, options);

        let maxWidth = 0;
        let maxHeight = 0;

        events.forEach((event)=>{
            if(event.type === "windowresize") {
                maxWidth = Math.max(maxWidth, event.data.width);
                maxHeight = Math.max(maxHeight, event.data.height);
            }
        });

        const draw = SVG().size(maxWidth, maxHeight);

        let lastPositionX = null;
        let lastPositionY = null;
        let timestampLastPosition = null;

        let pointerIsDown = false;

        const defaultDrawOptions = {
            move: {
                color: "black",
                timeFactor: 2,
                "strokeDash": null
            },
            drag:{
                color: "black",
                "strokeDash": "4"
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

        function drawPath(x, y, time, color, timeFactor, strokeDash) {
            let arcRadius = 0;

            if(timestampLastPosition != null) {
                let line = draw.line(lastPositionX, lastPositionY, x, y).fill({color: color}).stroke({width: 1, color: color});

                if(strokeDash != null) {
                    line.node.setAttribute("stroke-dasharray", strokeDash);
                }

                let timeDiffSeconds = (time - timestampLastPosition) / 1000.0;
                arcRadius += timeDiffSeconds * timeFactor;
            }

            let circle = draw.circle(arcRadius*2);
            circle.center(x,y);
            circle.fill({color: color}).stroke({color: color, width: 1});

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
                        drawPath(event.data.x, event.data.y, event.time, pointerIsDown?options.drag.color:options.move.color, options.move.timeFactor, pointerIsDown?options.drag.strokeDash:options.move.strokeDash);
                    }

                    break;

                case "click":
                    if(options.move !== false) {
                        drawPath(event.data.x, event.data.y, event.time, options.move.color, options.move.timeFactor, options.move.strokeDash);
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
                        drawPath(event.data.x, event.data.y, event.time, pointerIsDown?options.drag.color:options.move.color, options.move.timeFactor,  pointerIsDown?options.drag.strokeDash:options.move.strokeDash);
                    }

                    if(options.up !== false) {
                        drawCircle(event.data.x, event.data.y, options.up.color, options.up.size);
                    }

                    pointerIsDown = false;

                    break;

                default:
            }
        });

        return draw.node;
    }
}

window.UberTracker = UberTracker;
