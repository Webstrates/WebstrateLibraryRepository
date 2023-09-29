window.WPMv2.installAsset = async function installAsset(destination, source){
    if(typeof webstrate  !== "undefined") {
        let asset = webstrate.assets.findLast(a=>a.fileName==destination);
        if ((!asset) || (asset.deletedAt)){
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
            return true;
        }
    } else {
        console.log("AssetFetcher: Don't know how to fetch asset "+destination+" when not using webstrates, please manually download it from "+source);
    }
    return false;
}