window.WebstratePackageManagerUIHelper = class WebstratePackageManagerUIHelper {
    static async buildPackageListView(repositories, config={}) {
        if (typeof config.packageEntryView === "undefined"){
            config.packageEntryView = function(thePackage){return WebstratePackageManagerUIHelper.buildCompactPackageView(thePackage)};
        }
        if (typeof config.packageHeaderView === "undefined"){
            config.packageHeaderView = function(thePackage){return WebstratePackageManagerUIHelper.buildCompactHeaderView()};
        }        
        if (typeof config.packageFilter === "undefined"){
            config.packageFilter = function(thePackage){return true;};
        }        

        let view = cQuery("<div class='wpm_ui_helper_list'></div>");
        view[0].repositories = repositories;
        view[0].config = config;
        view.append(config.packageHeaderView());
                
        // Get already installed packages
        let packagesLeftToShow = [];
        if (typeof config.showAllPackages === "undefined" || config.showAllPackages===true){
            packagesLeftToShow = packagesLeftToShow.concat(await WPMv2.getCurrentlyInstalledPackages());
        }

        // Get packages from requested repositories        
        for (let i=0; i<repositories.length; i++){
            let packages = await WPMv2.getPackagesFromRepository(repositories[i]);
            for (let o=0; o<packages.length; o++){
                if (config.packageFilter(packages[o])){
                    // Build the view
                    let packageView = config.packageEntryView(packages[o]);
                    view.append(packageView);
                    
                    // Remove it from list of packages to show
                    packagesLeftToShow = packagesLeftToShow.filter(function(repositoryPackage){
                        return repositoryPackage.name!==packages[o].name;
                    });
                }
            }
        }
        // Packages from other repositories must fetch update info directly
        for (let i=0; i<packagesLeftToShow.length; i++){
            if (config.packageFilter(packagesLeftToShow[i])){
                let newPackage = await WPMv2.getLatestPackageFromPackage(packagesLeftToShow[i]);
                view.append(config.packageEntryView(newPackage));
            }
        }

        return view;
    }
    
    static buildCompactHeaderView(config={}){    
        return cQuery(`<div class='wpm_ui_helper_package_header wpm_ui_helper_compact'>
                <span class='wpm_ui_helper_packagename'>Package</span>
                <span class='wpm_ui_helper_packageversion'>Repos.</span>
                <span class='wpm_ui_helper_installedversion'>Here</span>
                <button class='wpm_ui_helper_action'>Update All</button></div>`);
    }
    
    static buildCompactPackageView(thePackage, config={}){
        let self = this;
        let packageContainer = cQuery("<div class='wpm_ui_helper_package wpm_ui_helper_compact'></div>");

        if (typeof config.onPackageInstalled==="undefined"){
            config.onPackageInstalled = function(){};
        }
        if (typeof config.onPackageSelection==="undefined"){
            config.onPackageSelection = function(aPackage){
                if (aPackage.name===thePackage.name){
                    cQuery(".wpm_ui_helper_selected").removeClass("wpm_ui_helper_selected");
                    packageContainer.addClass("wpm_ui_helper_selected");
                }
            }
        }
        packageContainer.on("click", function(){config.onPackageSelection(thePackage)});
        
        // Fetch metadata for potentially installed package
        let metaData = wpm.readMetadata(thePackage.name);
        if (metaData){
            packageContainer.addClass("wpm_ui_helper_installed");
        }
        
        if(cQuery(".packages transient .package#"+thePackage.name).length > 0) {
            packageContainer.addClass("wpm_ui_helper_transient");
        }
       
        if (thePackage.friendlyName){
            packageContainer.append("<span class='wpm_ui_helper_friendlyname'>"+thePackage.friendlyName+"</span>");
        } else {            
            packageContainer.append("<span class='wpm_ui_helper_friendlyname'>"+thePackage.name+"</span>");
        }
        packageContainer.append("<span class='wpm_ui_helper_packagename'>"+thePackage.name+"</span>");
        packageContainer.append("<span class='wpm_ui_helper_packageversion'>"+thePackage.version+"</span>");
        packageContainer.append("<span class='wpm_ui_helper_installedversion'>"+(metaData && metaData.version?metaData.version:"")+"</span>");
        
        if (thePackage.description){
            packageContainer.append("<span class='wpm_ui_helper_description'>"+thePackage.description+"</span>");
        }
        
        if (thePackage.documentationLink){
            packageContainer.append("<span class='wpm_ui_helper_documentationlink'><a href=\""+thePackage.documentationLink+"\" target=\"_blank\">Read More</a></span>");
        }
        
        if (thePackage.changelog && Object.keys(thePackage.changelog).length>0){
            let changeLog = cQuery("<div class='wpm_ui_helper_changelog'><div class='cl_header'>Recent Changes</div></div>");

            // TODO : Iterate log
            for (let version in thePackage.changelog){
                changeLog.append("<div class='wpm_ui_helper_changeentry'><div class='wpm_ui_helper_cle_head'>"+version+"</div>"+thePackage.changelog[version]+"</div>");
            }
            

            packageContainer.append(changeLog);
        }
                        
        
        if (config.showStateAsButton || typeof config.showStateAsButton==="undefined"){
            let button = cQuery("<button class='wpm_ui_helper_action'></button>");
            packageContainer.append(button);
            
            button.on("click", function(e){
                packageContainer.addClass("wpm_ui_helper_busy");
                let work = cQuery(this).data("work");
                e.stopPropagation();                
                work();
            });

            //Setup install/update work
            button.data("work", function() {
                return new Promise(function(resolve, reject) {
                    /*
                     * TODO: Reimplement install, maybee as require into head without static?
                     * 
                    WPMv2.require([thePackage]).then(function(){
                        config.onPackageInstalled(thePackage);
                        resolve();
                    });
                     */
                });
            });
            
            if (metaData){
                if (metaData.version!==thePackage.version){
                    button[0].innerText = "Update";
                } else {
                    button[0].innerText = "Remove";
                    
                    //Override work with remove
                    button.data("work", async function() {
                        /*
                         * TODO: Reimplement remove
                         * 
                        // Check dependency graph          
                        let dependencyChecks = [];
                        let dependingPackages = [];
                        let currentlyInstalledPackages = await WPMv2.getCurrentlyInstalledPackages();
                        
                        for(let p of currentlyInstalledPackages) {
                            let dependencyResult = await wpm.findNeededDependencies([p]);
                            if (dependencyResult.some(function(dependency){
                                return thePackage.name===dependency.name;
                            })){
                                dependingPackages.push(p);
                            }
                        }
                        
                        if (dependingPackages.length > 0){                                
                            if (confirm("Are you sure? This will also remove:\n"+dependingPackages.join("\n"))){
                                wpm.removePackages(dependingPackages);
                                wpm.removePackages([thePackage]);
                            }
                        } else {
                            wpm.removePackages([thePackage]);
                        }
                        */
                    });
                }
            } else {
                button[0].innerText = "Install";
            }
        } else {
            if (metaData){
                packageContainer.append("<span>Installed</span>");
            }
        }
        packageContainer.append("<div class='wpm_ui_helper_clearfix'></div>");
        return packageContainer;
    }
};

webstrate.on("loaded", function() {
    var updateAll = function(){
        cQuery(".wpm_ui_helper_list").forEach(function(view) {
            let before = view.nextSibling;
            let parent = view.parentNode;
            let repositories = view.repositories;
            let config = view.config;
            WebstratePackageManagerUIHelper.buildPackageListView(repositories, config).then(function(newView){
                parent.insertBefore(newView[0], before);
                view.remove();                
            });
        });
    };    
    
    /*
     * TODO: Add these types of events to WPMv2
     * 
    // Register update callbacks
    let wpm = new WebstratePackageManager();
    wpm.registerInstalledPackagesCallback(updateAll);
    wpm.registerRemovedPackagesCallback(updateAll);    
     */
});
