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

            // Supprime le bouton de recherche car pas besoin
            $("#searchtool").remove();

            // Desactive la suppression du marker lorsque le bottom panel est ferme
            //$(".mv-close.fas.fa-chevron-down").off("click");

            // Rajoute la class extend au bouton active du bottom-panel pour pouvoir supprimer la classe extend
            // quand le panneau est ferme. Sinon, seul la classe active est fermee et il n'est pas possible d'ouvrir le panneau
            // en lancant un traitement
            $(".mv-close.fas.fa-chevron-down").on("click", function(){
                $('#bottom-panel').removeClass('extend');
                $('#toolsBoxPopup').removeClass('hidden');
                $('#graphFlowSimulated').removeClass('hidden');
                $('#graphFlowSimulatedExtend').addClass('hidden');
                $('#bottom-panel-btn-extend').addClass('fa-angle-double-up ');
                $('#bottom-panel-btn-extend').removeClass('fa-angle-double-down');
                //$('.mv-close').addClass('fa-chevron-down');
                //$('.mv-close').removeClass('fa-angle-double-down');
            });

            // Configure la fenetre de resultat
            $(".popup-content").append(["<div id='toolsBoxPopup'>",
            "<div id='timerKillProcess'>",
            "<span id='countdown'>00:00</span>",
            "<div id='dismiss' class='hidden fas fa-times' onclick='mviewer.customControls.waterFlowSimulation.dismiss();'></div>",
            "</div>",
                "<div id='processingBar' class='progress'>",
                    "<div id='progression' class='progress-bar progress-bar-striped active' aria-valuenow='0' aria-valuemin='0' aria-valuemax='100' role='progressbar' style='background-color: #2e5367; width:0%;'>",
                    "</div>",
                    "<p id='processing-text' class='lang' key-lang='panelResultNoprocess'>",
                        "",
                    "</p>",
                "</div>",
                "<div id='divPopup1'></div>",
                "<div id='divPopup2'></div>",
                "<div id='divPopup4'></div>",
                "</div>",
                "<div id='graphFlowSimulated' class='profile-addon panel-graph'></div>",
                "<div id='graphFlowSimulatedExtend' class='profile-addon panel-graph hidden'></div>",
                "</div>"
            ].join(""));

            // bouton pour etendre le bottom panel. Pour ne pas rentrer en conflit avec le mviewer
            // lors du onclick, il ne faut pas mettre le texte entre "", le mviewer le fait tout seul ??? pourquoi ???
            $("#bottom-panel-btn").append(["<button id='bottom-panel-btn-extend' title='Etendre le graphique' class='btn btn-default fas fa-angle-double-up' type='button'",
            "onclick=$('#bottom-panel').toggleClass('extend');$('#graphFlowSimulated').toggleClass('hidden');",
            "$('#graphFlowSimulatedExtend').toggleClass('hidden');$('#toolsBoxPopup').toggleClass('hidden');",
            "$('#bottom-panel-btn-extend').toggleClass('fa-angle-double-up');$('#bottom-panel-btn-extend').toggleClass('fa-angle-double-down')>",
            //"$('.mv-close').toggleClass('fa-chevron-down');$('.mv-close').toggleClass('fa-angle-double-down')>",
            "</button>"].join(""));

            info.disable();

            // commande pour supprimer le layer une fois l'initialisation terminée
            $("li").remove(".list-group-item[data-layerid='initSimfen']");
        }
    };
}());
