window.WPMv2.installAsset = async function installAsset(destination, source){
    if(typeof webstrate  !== "undefined") {
        if (!webstrate.assets.find(a=>a.fileName==destination)){
            console.log("Initial fetch of asset "+destination+" from "+source+" ...");
            let formData = new FormData();
            
            let response = await fetch(source, {credentials: 'same-origin'});
            let blob = await response.blob();            
            formData.append("file", blob, destination);
            await fetch(location.pathname, {
                body: formData,
                credentials: 'same-origin',
                method: "post"
            });            
        }
    } else {
        console.log("AssetFetcher: Don't know how to fetch asset "+destination+" when not using webstrates, please manually download it from "+source);
    }
}