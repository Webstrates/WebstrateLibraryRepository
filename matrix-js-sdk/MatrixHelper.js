let getStorage = function getStorage(name, notSetValue){
    let data = localStorage.getItem("matrixHelper."+name);
    try {
        if (data) data = JSON.parse(data);
        return data;
    } catch (ex){
        console.log("matrixHelper localStorage parse error, reverting to default", name, data);
    }
    return notSetValue;
}   
let setStorage = function setStorage(name, value){
    localStorage.setItem("matrixHelper."+name, JSON.stringify(value));
}      

class MatrixHelper {
    static async requestLogin(){
        // TODO: Check if page has a remembered login
        let logins = getStorage("logins");

        if (false){
            // TODO: Use remembered login for this page
            return;
        } else {
            // TODO: Show selector
            let chosenLogin = logins[0]; // STUB: Pick the first one
            let device = getStorage("logins."+chosenLogin.userId);

            // Null sessions?
            if (device && device.deviceToImport && device.deviceToImport.olmDevice && device.deviceToImport.olmDevice.sessions){
                device.deviceToImport.olmDevice.sessions = device.deviceToImport.olmDevice.sessions.filter(function(val) { return val !== null; });
            }

            return device;
        }
    }

    static async login(url, username, password){
            

        // TODO: Check if already logged in with this userid

        // Create initial deviceID
        let client = matrixcs.createClient({
            baseUrl: url,
        });
        let details = await client.loginWithPassword(username, password);
        console.log(details);

        // Recreate client with a deviceId to initiate crypto
        client = matrixcs.createClient({
            baseUrl: url,
            accessToken: details.access_token,
            userId: details.user_id,
            deviceId: details.device_id
        });
        client.setDeviceDetails(details.device_id, {
            display_name: "Webstrates ("+location.host+")"
        });

        // Wait for verification from another source
        client.on("crypto.verification.request", function (event) {
            console.log("Got verification requst");
            event.accept();
            event.on('change', async function () {
                console.log("VerificationRequest.change", event.phase);

                // Phase 4 starts verify process
                if (event.phase === 4) {
                    event._verifier.verify();

                    // Just accept anything
                    setTimeout(function () {
                        console.debug(event);
                        event._verifier.sasEvent.confirm();
                    }, 2000);
                } else if (event.phase === 6){
                    console.log("Verification completed");
                    setTimeout(async function () {
                        let exportedDevice = await client.exportDevice();
                        let logins = getStorage("logins", []);
                        logins.push({
                            userId: details.user_id
                        });
                        setStorage("logins", logins);

                        // Save device
                        setStorage("logins."+details.user_id, {
                            deviceToImport: exportedDevice,
                            baseUrl: url,
                            accessToken: details.access_token
                        });
                    },2000);
                }
            });
        });        

        window.matrixHelper.client = client;
        await client.initCrypto();
        await client.startClient();
    }

    static async sendEncryptedToEveryone(client){
        // Ensure crypto is enabled
        await client.initCrypto();

        // Everyone is known and verified
        client.on('RoomMemberEvent.Membership', async (message, room, toStartOfTimeline) => {
            // STUB: Don't do this all the time!
            console.log("Setting devices known+verified")

            await client.exportRoomKeys();    
            const e2eMembers = await room.getEncryptionTargetMembers();
            for (const member of e2eMembers) {
                const devices = client.getStoredDevicesForUser(member.userId);
                for (const device of devices) {
                    await client.setDeviceKnown(member.userId, device.deviceId, true);
                    await client.setDeviceVerified(member.userId, device.deviceId, true);
                }
            }    
        });        
    }
}

window.matrixHelper = MatrixHelper;


