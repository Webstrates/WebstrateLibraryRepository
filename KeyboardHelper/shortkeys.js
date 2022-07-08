window.KeyboardHelper = class KeyboardHelper {
    static checkKeyCombo(combo, event){
        if (typeof combo.modifiers !== "undefined" && combo.modifiers instanceof Array){
            if (combo.modifiers.includes("shift") && !event.shiftKey) return false;
            if (combo.modifiers.includes("ctrl") && !event.ctrlKey) return false;
            if (combo.modifiers.includes("alt") && !event.altKey) return false;
            if (combo.modifiers.includes("meta") && !event.metaKey) return false;
        }
        let eventTypes = combo.events;
        //If no eventtypes defines, default to "keyup"
        if (typeof eventTypes === "undefined") {
            eventTypes = ["keyup"];
        }
        if (!eventTypes.includes(event.type)) return false;
        return combo.key === event.code;
    }
}
