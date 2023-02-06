let getStorage = function getStorage(name, notSetValue){
    let data = localStorage.getItem("matrixHelper."+name);
    if (data===null) return notSetValue;
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
let showAccountSelector = function showAccountSelector(){
    return new Promise((resolve, reject)=>{
        // Show the selector UI
        let popup = document.createElement("transient");
        popup.setAttribute("style", `
            position:fixed;
            backdrop-filter:blur(1em) saturate(0) brightness(0.5);
            left: 0;
            top: 0;
            right: 0;
            bottom: 0;
            display:flex;
            justify-content:center;
            align-items:center`);
        popup.innerHTML = `
        <style>
            matrixlogin {
                padding:1.5rem;
                max-width: 20rem;
                background:white;
                border-radius:1rem;
                box-shadow:0.25rem 0.25rem 1rem rgba(0,0,0,0.2);
            }
            matrixlogin h1 {
                font-family: sans-serif;
                margin: 0;
                font-size: 1.4rem;
                border-bottom: 1px solid lightgrey;
            }
            matrixlogin ul {
                background: #efefef;
                margin: 0;
                list-style: none;
                padding: 0;        
            }
            matrixlogin ul li {
                position: relative;
                padding: 0.5rem 1rem;
                font-weight: bold;
                font-family: sans-serif;
                cursor: pointer;
                border-bottom: 1px solid lightgrey;
                display: flex;
                flex-direction: column;
                justify-content: center;
                padding-right: 2em;        
                transition: background 0.25s, opacity 0.25s ease-in-out;
                opacity: 0.9;
                min-height: 2.5rem;
            }
            matrixlogin ul li:after {
                position: absolute;
                right: 0;
                content: ">";
                font-size: 2rem;
                font-weight: normal;
                padding-right: 0.5rem;
                opacity: 0.2;
            }
            matrixlogin ul li .server {
                font-size: 0.8em;
                opacity: 0.7;
                font-weight: normal;        
            }
            matrixlogin ul li:hover {
                background: #d9dee5;
                opacity: 1;
            }
            matrixlogin ul li.matrix-new-login {
                opacity: 0.5;
                font-weight: normal;
                font-size: 0.9em;
            }        
            matrixlogin table {
                width: 100%;
            }
            matrixlogin table input {
                width: 100%;
                box-sizing: border-box;
                padding: 0.5em;
            }
            matrixlogin table th {
                text-align: right;
                padding: 0.5em;
                font-weight: normal;        
            }
            matrixlogin table button {
                float: right;
                margin: 1em;
                padding: 0.5em 1em;     
                cursor: pointer;   
            }
            matrixlogin .matrix-spinner {
                display: inline-block;
                position: relative;
                width: 80px;
                height: 80px;
            }
            matrixlogin .matrix-spinner div {
                position: absolute;
                border: 4px solid #1e61c5;
                opacity: 1;
                border-radius: 50%;
                animation: matrix-ripple 1s cubic-bezier(0, 0.2, 0.8, 1) infinite;
            }
            matrixlogin .matrix-spinner div:nth-child(2) {
                animation-delay: -0.5s;
            }
            @keyframes matrix-ripple {
                0% {
                    top: 36px;
                    left: 36px;
                    width: 0;
                    height: 0;
                    opacity: 0;
                }
                4.9% {
                    top: 36px;
                    left: 36px;
                    width: 0;
                    height: 0;
                    opacity: 0;
                }
                5% {
                    top: 36px;
                    left: 36px;
                    width: 0;
                    height: 0;
                    opacity: 1;
                }
                100% {
                    top: 0px;
                    left: 0px;
                    width: 72px;
                    height: 72px;
                    opacity: 0;
                }
            }
            matrixlogin .matrix-flippable {
                contain: paint;
            }
            matrixlogin .matrix-flippable > * {
                transition: transform 0.25s ease-in-out;
                transform: translateX(100%);
                position: absolute;
            }
            matrixlogin .matrix-flippable > *.active {
                transform: translateX(0%);
                position: relative;
            }    
            matrixlogin .matrix-flippable > *.flipped {
                transform: translateX(-100%);
            }    
        </style>
        <matrixlogin>
            <h1>Matrix Authentication</h1>
            <div class="matrix-flippable">
                <ul class="active">
                    <li class="matrix-new-login">Add Account...</li>
                </ul>
                <table id="matrix-login-form">
                    <tr><th>User</th><td><input class="username" placeholder="bob"></td></tr>
                    <tr><th>Server</th><td><input class="server" placeholder="https://someserver.somedomain"></td></tr>
                    <tr><th>Password</th><td><input type="password" placeholder="Password"></td></tr>
                    <tr><th></th><td><button class="matrix-login">Login ></button>            
                </table>
                <div id="matrix-verification">
                    <div style="text-align:center"><div class="matrix-spinner"><div></div><div></div></div></div>
                    <br />
                    Use another Matrix client to verify the login to complete the process            
                </div>
                <div id="matrix-reloaded">
                    <div style="text-align:center;color:darkgreen;font-size:4rem">✓</div>
                    Account added!                    
                </div>        
            </div>
            <p style="font-size: 0.8rem;opacity: 0.5;margin-bottom: 0;">Warning: Logging in allows all webstrates on this server to (ab)use your account on this device</p>
        </matrixlogin>`;
        
        let logins = getStorage("logins", []);
        if (logins){
            logins.forEach((login)=>{
                let user = login.userId.match("@(.*):")[1];
                let server = login.userId.substr(login.userId.indexOf(":")+1);
                let node = document.createElement("li");
                node.innerHTML = user+"<div class='server'>"+server+"</div>";
                node.addEventListener("click", ()=>{
                    popup.remove();
                    resolve(login);
                });
                popup.querySelector("ul").prepend(node);
            });
        }

        document.body.appendChild(popup);
        popup.querySelector("matrixlogin .matrix-new-login").addEventListener("click", ()=>{
            popup.querySelector(".active").setAttribute("class", "flipped");
            popup.querySelector("#matrix-login-form").classList.add("active");
        });

        popup.querySelector("matrixlogin .matrix-login").addEventListener("click", ()=>{
            popup.querySelector("#matrix-login-form").style.opacity = 0.5;

            let user = popup.querySelector("#matrix-login-form input.username").value;
            let server = popup.querySelector("#matrix-login-form input.server").value;
            let password = popup.querySelector("#matrix-login-form input[type='password']").value;

            let callbacks = {
                loginFailed: ()=>{
                    alert("Username, server or password incorrect!");
                    popup.querySelector("#matrix-login-form").style.opacity=1;
                },
                verificationStarted: ()=>{
                    popup.querySelector(".active").setAttribute("class", "flipped");
                    popup.querySelector("#matrix-verification").setAttribute("class", "active");
                },
                verificationCompleted: (login)=>{
                    popup.querySelector(".active").setAttribute("class", "flipped");
                    popup.querySelector("#matrix-reloaded").setAttribute("class", "active");
                    
                    setTimeout(()=>{
                        popup.remove();
                        resolve(login);
                    }, 3000);
                }
            }
            let login = matrixHelper.login(server, user, password, callbacks);

            // TODO: Maybe don't ask the user to reload?
        });            
        
    });
};

class MatrixHelper {
    static async createClient(overrides={}){
        console.log("Requesting Matrix client", overrides);
        
        if (!window.matrixHelper.chosenLogin){
            // TODO: Check if page has a remembered login
            let hasRememberedLogin = false;
            if (hasRememberedLogin){
                // TODO: Use remembered login for this page            
            }        

            // Pick an account
            window.matrixHelper.chosenLogin = await showAccountSelector();
        }
        
        let login = getStorage("logins."+window.matrixHelper.chosenLogin.userId);
        
        // Null sessions?
        if (login?.deviceToImport?.olmDevice?.sessions){
            login.deviceToImport.olmDevice.sessions = login.deviceToImport.olmDevice.sessions.filter(function(val) { return val !== null; });
        }
        
        // Shutdown previous client (if any)        
        if (window.matrixHelper.client){
            console.log("Shutting down previous matrixHelper client...");
            window.matrixHelper.client.stopClient();
        }
        window.matrixHelper.client = matrixcs.createClient(login); //TODO: actually use the overrides
        return window.matrixHelper.client;
    }

    static async login(url, username, password, callbacks={}){
        // TODO: Check if already logged in with this userid

        // Create initial deviceID
        let client = matrixcs.createClient({
            baseUrl: url
        });
        let details;
        try {
            details = await client.loginWithPassword(username, password);
        } catch (ex){
            if (callbacks.loginFailed) callbacks.loginFailed(ex);
            return;
        }
        console.log(details);

        // Recreate client with a deviceId to initiate crypto verification
        if (callbacks.verificationStarted) callbacks.verificationStarted();
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
            console.log("Got verification request:", event);
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
                        let login = {
                            userId: details.user_id
                        };
                        logins.push(login);
                        setStorage("logins", logins);

                        // Save device
                        setStorage("logins."+details.user_id, {
                            deviceToImport: exportedDevice,
                            baseUrl: url,
                            accessToken: details.access_token
                        });
                        if (callbacks.verificationCompleted) callbacks.verificationCompleted(login);
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
        client.on('Room.timeline', async (message, room, toStartOfTimeline) => {
            // STUB: Don't do this all the time!
            await client.exportRoomKeys();    
            const e2eMembers = await room.getEncryptionTargetMembers();
            for (const member of e2eMembers) {
                const devices = client.getStoredDevicesForUser(member.userId);
                for (const device of devices) {
                    if (!device.known) await client.setDeviceKnown(member.userId, device.deviceId, true);
                    if (!device.verified) await client.setDeviceVerified(member.userId, device.deviceId, true);
                }
            }    
        });        
    }
    
    static async rememberAccount(){
        
    }
}

window.matrixHelper = MatrixHelper;


