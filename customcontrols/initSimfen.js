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
            $(".mv-header")[0].children[0].textContent = "Résultats";
            $(".mv-header")[0].children[0].className += "lang";
            $(".mv-header")[0].children[0].setAttribute("key", "panelResultTitle");

            $(".mv-title")[0].className += " lang";
            $(".mv-title")[0].setAttribute("key", "portalTitle");

            // Ajoute les attributs pour modifier la langue
            for (var i = 0; i < $(".level-2").length; i++) {
                $(".level-2")[i].childNodes[0].className += "lang";
                $(".level-2")[i].childNodes[0].setAttribute("key", $(".level-2")[i].childNodes[0].textContent);
            }

            // Ajoute les attributs pour modifier la langue
            for (i = 0; i < $(".mv-nav-item").length; i++) {
                if (($(".mv-nav-item")[i].childNodes[0].innerHTML).includes("mv-unchecked")) {
                    $(".mv-nav-item")[i].childNodes[0].innerHTML = "<span class=\"state-icon fa mv-unchecked\"></span><div class=\"lang\" key=\"" + $(".mv-nav-item")[i].dataset.layerid + "\">" + $(".mv-nav-item")[i].childNodes[0].textContent + "</div><input type=\"checkbox\" class=\"hidden\" value=\"false\">";
                } else {
                    $(".mv-nav-item")[i].childNodes[0].innerHTML = "<span class=\"state-icon fa mv-checked\"></span><div class=\"lang\" key=\"" + $(".mv-nav-item")[i].dataset.layerid + "\">" + $(".mv-nav-item")[i].childNodes[0].textContent + "</div><input type=\"checkbox\" class=\"hidden\" value=\"true\">";
                }
            }

            // Supprime le bouton de recherche car pas besoin
            $("#searchtool").remove();

            // Configure la fenetre de resultat
            $(".popup-content").append(["<div id='toolsBoxPopup'>",
                "<div id='processingBar' class='progress'>",
                    "<div id='progression' class='progress-bar progress-bar-striped active' aria-valuenow='0' aria-valuemin='0' aria-valuemax='100' role='progressbar' style='background-color: #007ACC; width:0%;'>",
                        "<p id='processing-text' class='lang' key='panelResultNoprocess'>",
                            "Aucun processus en cours",
                        "</p>",
                    "</div>",
                "</div>",
                "<div id='divPopup1'></div>",
                "<div id='divPopup2'></div>",
                "<div id='divPopup3'></div>",
                "</div>",
                "<div id='graphFlowSimulated' class='profile-addon panel-graph'></div>",
                "</div>"
            ].join(""));
            
            info.disable();

            // commande pour supprimer le layer une fois l'initialisation terminée
            $("li").remove(".list-group-item[data-layerid='initSimfen']");

            // Ajoute les attributs de langue
            for (i = 0; i < $(".list-group-item").length; i++) {
                $(".list-group")[0].childNodes[i].childNodes[0].childNodes[0].innerHTML = "<span class=\"lang\" key=\"" + $(".list-group")[0].childNodes[i].childNodes[0].childNodes[0].offsetParent.dataset.layerid + "\">" + $(".list-group")[0].childNodes[i].childNodes[0].childNodes[0].textContent + "</span>";
            }
        }
    };
}());