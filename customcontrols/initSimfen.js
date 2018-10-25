mviewer.customControls.initSimfen = (function () {
    /*
     * Private
     */

    // $.getScript("module.js", function(){
    //     alert("Script loaded but not necessarily executed.");
    // });

    // var rawFile = new XMLHttpRequest();
    // rawFile.open("GET", "config.json", false);
    // rawFile.onreadystatechange = function ()
    // {
    //     if(rawFile.readyState === 4)
    //     {
    //         if(rawFile.status === 200 || rawFile.status == 0)
    //         {
    //             var allText = $.xml2json(rawFile.responseXML);
    //             alert(allText.url);
    //         }
    //     }
    // }
    // rawFile.send(null);

    return {
        /*
         * Public
         */

        init: function () {
            // Modification de l'interface par défaut du MViewer
            document.getElementsByClassName("mv-header")[0].children[0].textContent = "Résultats";
            document.getElementById("searchtool").remove();

            // Configure la fenetre de resultat
            $(".popup-content").append("\
                <div id='toolsBoxPopup' style='margin-left: 10px; width: 400px;\
                    height: 320px; position: absolute;'>\
                    <div id='processingBar' class='progress' style='text-align: center; width: 400px;\
                        background-color: #808080'>\
                        <div id='progression' class='progress-bar progress-bar-striped active' aria-valuenow='0' aria-valuemin='0' aria-valuemax='100' role='progressbar'\ style='background-color: #007ACC; width:0%;'>\
                            <p id='processing-text' style='text-align: center;width: 400px;color: white;font-size:18px;'>\
                            Aucun processus en cours\
                            </p>\
                        </div>\
                    </div>\
                    <div id='divPopup1'></div>\
                    <div id='divPopup2'></div>\
                    <div id='divPopup3'></div>\
                </div>\
                <div id='graphFlowSimulated' class='profile-addon panel-graph' style='height: 320px; width:50%; margin: 0 auto;'></div>\
                </div>");

            info.disable();

            // commande pour supprimer le layer une fois l'initialisation terminée
            $("li").remove(".list-group-item[data-layerid='initSimfen']");
        } 
    };
}());
