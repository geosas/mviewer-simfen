mviewer.customControls.baie = (function () {
    /*
     * Private
     */

    var _draw; // global so we can remove it later
    var _drawPolygon;
    var _stationLayer;
    var _xy;
    var _xhrPost;
    var _xhrGet;
    var _xmlRequest;
    var _rqtWPS;
    var _urlWPS = "https://wps.geosas.fr/simfen-test?";
    var _service = "WPS";
    var _version = "1.0.0";
    var _request = "Execute";
    var _identifierBaie = "baieSimulation";
    var _getStations = "getStationsAvailable";
    var _identifierXY = "xyOnNetwork";
    var _identifierGetMeasuredFlow = "getMeasuredFlow";
    var _identifierDismiss = "dismiss";
    var _identifierGetInfos = "getInfos";
    var _uuid;
    var _storeExecuteResponse = true;
    var _lineage = true;
    var _status = true;
    var _refreshTime;
    var _timeOut;
    var _updating;
    var _countdown;
    var _nameColor = [];
    var _traces = [];
    var _layout;
    var _timeoutCount = 0;
    var _colors = ["red", "#8b4513", "#FF8C00", "#20B2AA", "purple"];
    var _processing = false;
    var _stationsSelectedByUser;
    var _select;
    var _timerCountdown;
    var _display;
    var _configurationInfos = [];
    var _initProject = "archives_dreal";
    var selection_baie=[]
    var select
    var note=0
    var targetArea
    var key_gap
    var obstacle
    var influence_arr = []
    var polygonSelection
    // Permet d'utiliser l'equivalent de .format{0} dans js (source :stack overflow)
    if (!String.format) {
        String.format = function (format) {
            var args = Array.prototype.slice.call(arguments, 1);
            return format.replace(/{(\d+)}/g, function (match, number) {
                return typeof args[number] != 'undefined' ?
                    args[number] :
                    match;
            });
        };
    }

    // Cree la variable xmlrequest
    function getXDomainRequest() {
        var xhr = null;
        // sous internet explorer
        if (window.XDomainRequest) {
            xhr = new XDomainRequest();
            // autres navigateurs
        } else if (window.XMLHttpRequest) {
            xhr = new XMLHttpRequest();
        } else {
            // translate
            if (mviewer.lang.lang == "en") {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: "Error initialisation XMLHttpRequests",

                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Erreur',
                    text: "Erreur initialisation XMLHttpRequests",
                });
            }
        }
        return xhr;
    }

    // Permet de gerer les requetes cross-domain
    function ajaxURL(url) {
        // relative path
        if (url.indexOf('http') !== 0) {
            return url;
        }
        // same domain option déactivée à cause du http et https qui entrainne une blocage
        //else if (url.indexOf(location.protocol + '//' + location.host) === 0) {
          //  return url;}
        else {
            return '/proxy/?url=' + encodeURIComponent(url);
        }
    }

    function insideProjectArea(X, Y) {
        // si le point cliqué est dans la zone du projet, permet son execution
        if (X < 120000 || X > 417000 || Y < 6658714 || Y > 6902794) {
            return false;
        } else {
            return true;
        }
    }

    function buildPostRequest(dictInputs, identifier) {
        // Cree la requete POST du process
        _xmlRequest = String.format(['<?xml version="1.0" encoding="UTF-8"?>',
            '<wps:{0} xmlns:ows="http://www.opengis.net/ows/1.1" xmlns:wps="http://www.opengis.net/wps/1.0.0" ',
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="{1}" service="{2}" ',
            'xsi:schemaLocation="http://www.opengis.net/wps/1.0.0 http://schemas.opengis.net/wps/1.0.0/wpsAll.xsd">',
            '<ows:Identifier>{3}</ows:Identifier><wps:DataInputs>'
        ].join(""), _request, _version, _service, identifier);

        // split le dictionnaire contenant les parametres et valeurs
        var dataIdentifiers = Object.keys(dictInputs);
        var dataInputs = Object.keys(dictInputs).map(function (itm) {
            return dictInputs[itm];
        });

        // genere la partie du xml contenant les parametres et valeurs
        for (var i = 0; i < dataIdentifiers.length; i++) {
            inputXml = String.format(['<wps:Input><ows:Identifier>{0}</ows:Identifier>',
                '<wps:Data><wps:LiteralData>{1}</wps:LiteralData></wps:Data></wps:Input>'
            ].join(""), dataIdentifiers[i], dataInputs[i]);
            _xmlRequest += inputXml;
        }

        // termine la generation du document pour une execution asynchrone et contenant le statut et les parametres en entree
        _xmlRequest += String.format(['</wps:DataInputs><wps:ResponseForm><wps:ResponseDocument ',
            'storeExecuteResponse="{0}" lineage="{1}" status="{2}"></wps:ResponseDocument>',
            '</wps:ResponseForm></wps:{3}>'
        ].join(""), _storeExecuteResponse, _lineage, _status, _request);

        return _xmlRequest;
    }

    function processingBarUpdate(percent, message) {
        // Fonction pour mettre a jour la barre de progression selon les valeurs du wps
        if (percent === 100) {
            // si le traitement est termine, supprime l'animation (via la valeur 0), et met le fond en bleu
            percent = 0;
            $("#processingBar").css("backgroundColor", "#2e5367");
        } else {
            $("#processingBar").css("backgroundColor", "#808080");
        }
        $("#progression").css("width", percent + "%");
        $("#progression").attr("aria-valuenow", percent);
        $("#processing-text").text(message);
    }

    function getAndSetStatus(response) {
        // Met a jour le texte dans la barre de progression selon le document de reponse du wps
        // et arrete l'actualisation du process s'il est termine ou failed
        if (response.Status.ProcessAccepted) {
            // translate
            if (mviewer.lang.lang == "en") {
                processingBarUpdate(5, "Waiting queue : please wait");
            } else {
                processingBarUpdate(5, "File d'attente : veuillez patienter");
            }

        } else if (response.Status.ProcessStarted) {
            if ($("#countdown")[0].textContent == "00:00"){
                startTimer(_timerCountdown, _display);
            }
            //console.log(response.Status.ProcessStarted);
            if (response.Status.ProcessStarted == "No station available on the period"){
                // translate
                if (mviewer.lang.lang == "en") {
                    processingBarUpdate(100, "Change the simulation period");
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: "No stations with data at the start and end date are available, please change them and try again",
                    });

                } else {
                    processingBarUpdate(100, "Modifiez la période de simulation");
                    Swal.fire({
                        icon: 'error',
                        title: 'Erreur',
                        text: "Aucune station ayant des données à la date de début et de fin n'est disponible, veuillez changer les dates et réessayer",
                    });
                }
                clearInterval(_updating);
                clearInterval(_countdown);
                $("#dismiss").toggleClass("hidden");
                $("#countdown")[0].textContent = "00:00";
                _processing = false;
            } else {
                var percent = response.Status.ProcessStarted.percentCompleted;
                processingBarUpdate(percent, response.Status.ProcessStarted);
            }

        } else if (response.Status.ProcessSucceeded) {
            // translate
            if (mviewer.lang.lang == "en") {
                processingBarUpdate(100, "Finished");
            } else {
                processingBarUpdate(100, "Terminé");
            }
            clearInterval(_countdown);
            $("#countdown")[0].textContent = "00:00";

        } else if (response.Status.ProcessFailed) {
            _processing = false
            // Arrête la requete response.Status.ProcessFailed
            processingBarUpdate(0,response.Status.ProcessFailed.ExceptionReport.Exception.ExceptionText );
            clearInterval(_updating);
            clearInterval(_countdown);
            $("#countdown")[0].textContent = "00:00";
            if (mviewer.lang.lang == "en") {
                txt_error="An error has occurred, if it persists please contact with the information below. If the process is blocked, refresh the page";
            } else {
                txt_error="Une erreur c'est produite, si elle persiste veuillez nous contacter et nous communiquer les informations ci-dessous. Si le processus est bloqué actualiser la page";
            }
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: txt_error,
              footer:_uuid+'Station : '+_stationsSelectedByUser+'  Date : '+new Date().toLocaleString(),
            });

        }
    }

    function updateProcess(url, cb) {
        if (_processing) {
            //var start_time = new Date().getTime();
            _xhrGet = getXDomainRequest();
            _xhrGet.addEventListener("loadend", cb);
            // test pour ne pas reexucter la requete, car le clearinterval possede un
            // un envoie de trop en cas d'un ralentissement du navigateur
            _xhrGet.open("GET", ajaxURL(url), true);
            // indique un timeout pour empecher les requetes
            // de s'executer indefiniment dans le cas ou le navigateur
            // passe des requetes en cache.
            _xhrGet.timeout = _timeOut;
            // si trop de timeout, arrete l'actualisation
            _xhrGet.ontimeout = function () {
                _timeoutCount += 1;
                if (_timeoutCount === 1) {
                    clearInterval(_updating);
                    clearInterval(_countdown);
                    $("#countdown")[0].textContent = "00:00";
                    // translate
                    if (mviewer.lang.lang == "en") {
                        processingBarUpdate(0, "The server is not responding, restart the treatment");
                    } else {
                        processingBarUpdate(0, "Le serveur ne répond pas, relancez le traitement");
                    }
                    _timeoutCount = 0;
                    _processing = false;
                }
            };

            _xhrGet.addEventListener('readystatechange', function () {
                if (_xhrGet.readyState === XMLHttpRequest.DONE && _xhrGet.status === 200) {
                    // Converti le xml en JSON pour pouvoir interagir avec les tags
                    // depuis n'importe quel navigateur (EDGE ne comprend pas les tags wps: et autres)
                    // tres important de le faire et ça evite de faire des getElements...)
                    var response = $.xml2json(_xhrGet.responseXML);
                    // recupere et met a jour le status du traitement
                    getAndSetStatus(response);
                    //var request_time = new Date().getTime() - start_time;
                    //console.log("La requete a pris : " + request_time);
                    if (!(response.Status.ProcessAccepted) && !(response.Status.ProcessStarted)) {
                        // arrete l'ecoute du status puisque le process est termine
                        clearInterval(_updating);
                        if (response.Status.ProcessSucceeded) {
                            // Hide kill process button
                            $("#dismiss").toggleClass("hidden");
                            // le comptage n'est pas le meme s'il y a plusieurs outputs
                            var outputsTags = Object.keys(response.ProcessOutputs).map(function (itm) {
                                return response.ProcessOutputs[itm];
                            });
                            var iteration;
                            if (outputsTags[0].length > 1) {
                                iteration = outputsTags[0].length;
                            } else {
                                iteration = outputsTags.length;
                            }

                            for (var i = 0; i < iteration; i++) {
                                var outputTag;
                                if (iteration === 1) {
                                    outputTag = outputsTags[0];
                                } else {
                                    outputTag = outputsTags[0][i];
                                }

                                if (outputTag.Identifier === "SimulatedFlow") {
                                    plotDatas_baie(outputTag.Data.ComplexData);
                                    _processing = false;

                                } else if (outputTag.Identifier === "dismiss") {
                                    // Hide kill process button
                                    $("#dismiss").toggleClass("hidden");
                                    _processing = false;
                                } else if (outputTag.Identifier === "configInfos") {
                                    setConfigInfos(outputTag.Data.LiteralData);
                                    _processing = false;
                                }
                            }
                        }
                    }
                }
            });
            _xhrGet.send();

        } else {
            clearInterval(_updating);
            clearInterval(_countdown);
            // translate
            if (mviewer.lang.lang == "en") {
                console.log("End of treatment");
            } else {
                console.log("Fin du traitement");
            }
            $("#countdown")[0].textContent = "00:00";
            _processing = false;
        }
    }

    function setConfigInfos(infos){
        // Supprime des caracteres superflus
        infos = infos.replace(/['[\] ]/g,"").split(",");

        // Itere les projets et divise la longueur par 3
        //puisque nom project, datemin, datemax
        for (var i = 0; i < infos.length/3; i++){
            var project = new Option(infos[i*3], infos[i*3]);
            _configurationInfos.push({
                [infos[i*3]] : {
                    datemin: infos[i*3+1],
                    datemax: infos[i*3+2]
                }
            });
            // pour modifier les textes des options de donnees
            if (infos[i*3] == "dreal_b") {
                textOption = "GéoBretagne";
            }
            else if (infos[i*3] == "banque_hydro_24h"){
                textOption = "Banque hydro bretagne2";
            }
             else {
                textOption = infos[i*3].replace(/_/g,' ');
            }
            $(project).html(textOption);
            $("#selectProjectInversion").append(project);
        }
        // init date and selection from default project
        $("#selectProjectInversion option[value="+_initProject+"]").attr('selected',true);
        for(var i = 0; i < _configurationInfos.length; i++){
            if(_configurationInfos[i][_initProject]){
                // substr a cause du format timestamp(Y-M-d H-M-S)
                dateMinSim = _configurationInfos[i][_initProject].datemin.substr(10,10);
                dateMaxSim = _configurationInfos[i][_initProject].datemax.substr(10,10);
            }
        }

        // Defini les dates de simulation possibles
        $("#dateStartbaie").attr("min", dateMinSim);
        $("#dateStartbaie").attr("max", dateMaxSim);

        // Defini une valeur par defaut où 50% des stations existent
        if (_initProject == "archives_dreal"){$("#dateStartbaie").val("1984-01-01");

        } else {$("#dateStartbaie").val(dateMinSim);}

        $("#dateEndbaie").attr("min", dateMinSim);
        $("#dateEndbaie").attr("max", dateMaxSim);
        $("#dateEndbaie").val(dateMaxSim);
    }

    function processExecution() {
        _xhrPost = getXDomainRequest();
        _xhrPost.open("POST", ajaxURL(_urlWPS), true);
        _xhrPost.timeout = _timeOut;
        _xhrPost.addEventListener('readystatechange', function () {
            if (_xhrPost.readyState === XMLHttpRequest.DONE && _xhrPost.status === 200) {
                // Recupere le xml de la reponse
                var response = $.xml2json(_xhrPost.responseXML);
                // Recupere l'url de la variable statusLocation
                var statusLocationURL = response.statusLocation;
                // Get UUID of process
                _uuid = statusLocationURL.split("/")[statusLocationURL.split("/").length-1].split(".")[0];
                // Maj de la barre de progression
                if (mviewer.lang.lang == "en") {processingBarUpdate(0, "Launching the query");}
                else{processingBarUpdate(0, "Lancement de la requête");}


                var promise = Promise.resolve(true);
                // Debut d'ecoute du resultat
                _updating = setInterval(function () {
                    // permet de gerer l'attente avant de relancer une requete
                    // par contre, dans le cas d'un ralentissement, une requete est
                    // envoyee, d'ou le if dans updateProcess
                    promise = promise.then(function () {
                        return new Promise(function (resolve) {
                            updateProcess(statusLocationURL, resolve);
                        });
                    });
                }, _refreshTime);
            }
        });
        _xhrPost.send(_rqtWPS);
    }

    function deleteLayers(layers){
        // suppression des layers
        var layersToRemove = [];
        _map.getLayers().forEach(function (layer) {
            for (var i = 0; i < layers.length; i++) {
                if (layer.get('name') != undefined && layer.get('name') === layers[i]) {
                    layersToRemove.push(layer);
                }
            }
        });
        var len = layersToRemove.length;
        for (var i = 0; i < len; i++) {
            _map.removeLayer(layersToRemove[i]);
        }
    }

    function setOutputFile(datasx, datasy){
        // Fonction pour generer le document de reponse contenant
        // la licence, les metadonnees de calcul et la simulation

        // Header of csvfile = Licence in panelDisclaimer
        var outFile = $("[i18n='panelDisclaimer']").text() + "\r\n";

        // Append calculation metadata
        listStations=JSON.stringify(influence_arr)
        var metadonneesCalcul;
        // translate
        if (mviewer.lang.lang == "en") {
            metadonneesCalcul = "x;y;start;end;timestep;hydrographic-network" + "\r\n";
        } else {
            metadonneesCalcul = "x;y;debut;fin;pas-de-temps;réseau-hydrographique" + "\r\n";
        }
        var period;
        if ($("input[name='deltaTbaie']:checked").val() == 1440) {
            // translate
            if (mviewer.lang.lang == "en") {
                period = "daily";
            } else {
                period = "journalier";
            }
        } else if ($("input[name='deltaTbaie']:checked").val() == 60) {
            // translate
            if (mviewer.lang.lang == "en") {
                period = "hourly";
            } else {
                period = "horaire";
            }
        }
        // translate
        var hydroNetwork;
        if (mviewer.lang.lang == "en") {
            hydroNetwork = "Réseau hydrographique étendu";//"modeled hydrographic network thresholded at 25 ha (DEM 50m)";
        } else {
            hydroNetwork = "Réseau hydrographique étendu";//"réseau hydrographique modélisé seuillé à 25ha (MNT 50m)";
        }
        metadonneesCalcul += String.format("{0};{1};{2};{3};{4};{5}" ,
            _xy[0],
            _xy[1],
            $("#dateStartbaie").val(),
            $("#dateEndbaie").val(),
            period,
            hydroNetwork) + "\r\n";


        // Ajoute les metadonnées au fichier de sortie
        outFile += metadonneesCalcul;

        // Produit la sortie des debits simules
        var outputSimulation;
        outputSimulation = "date;runoff(m3/s)" + "\r\n";

        // construit chaque ligne du csv selon les donnees
        for (var i = 0; i < datasx.length; i++) {
            var line = '';
            line += datasx[i] + ";" + datasy[i];
            outputSimulation += line + '\r\n';
        }

        // Ajoute les debits simules au fichier de sortie
        outFile += outputSimulation;

        // cree le csv
        var blob = new Blob([outFile], {
            type: "text/csv"
        });
        var url = URL.createObjectURL(blob);

        // cree l'url de telechargement et lie le fichier blob a celui-ci
        // et l'ajoute dans le tableau de bord
        var glyphiconSave = document.createElement("span");
        glyphiconSave.setAttribute("class", "glyphicon glyphicon-save");

        var dlFile = document.createElement("a");
        dlFile.setAttribute("id", "linkDownloadFlow");
        dlFile.setAttribute("href", url);
        dlFile.setAttribute("target", "_blank");
        dlFile.setAttribute("style", "color:#337ab7;font-family:inherit;display:block;font-size:20px;");
        if ($("#identifiantSimulation").val()) {
            dlFile.setAttribute("download", String.format("{0}_debit.csv", $("#identifiantSimulation").val()));
        } else {
            dlFile.setAttribute("download", "output_simulation.csv");
        }
        // translate
        var text;
        if (mviewer.lang.lang == "en") {
            text = "Water flow simulated ";
        } else {
            text = "Débits simulés ";
        }
        dlFile.appendChild(document.createTextNode(text));
        $("#divPopup1").append(dlFile);
        $("#linkDownloadFlow").append(glyphiconSave);
    }

    function plotDatas_baie(points) {

        var datasJson = JSON.parse(points);
        var xDatas = [];
        var yDatas = [];
        for (var i = 0; i < datasJson.length; i++) {
            xDatas.push(datasJson[i][0]);
            yDatas.push(datasJson[i][1]);

        }

        // cree un fichier contenant les donnees au format csv
        // et permet son telechargement
        // genere plusieurs fichiers (debit, metadonnees, licence)
        //setOutFiles(xDatas, yDatas);
        // genere un seul fichier de sortie
        setOutputFile(xDatas, yDatas);

        // translate
        var text;
        if (mviewer.lang.lang == "en") {
            text = "Water flow simulated ";
        } else {
            text = "Débits simulés ";
        }
        //scattergl Implement WebGL for increased speed
        _traces = [{
            name: text,
            x: xDatas,
            y: yDatas,
            mode:"lines",
            type: 'scattergl',
            line: {
                color: 'black'
            },
            connectgaps: 'false'
        }];

        _layout = {
            xaxis: {
                title: 'Date',
            },
            yaxis: {
                title: 'm3/s'
            },
            showlegend: true,
            margin: {
                l: 40,
                r: 20,
                b: 40,
                t: 20
            }
        };

        Plotly.newPlot($("#graphFlowSimulated")[0], _traces, _layout, {
            responsive: false,
            modeBarButtonsToRemove: ["toggleSpikelines", "zoomIn2d", "zoomOut2d"],
            scrollZoom: true
        });

        // duplication des graphiques et utilisation de la classe hidden (visibility) car
        // plotly.relayout pose soucis, impossible de depasser 450px de height et impossible
        // de revenir a l'etat d'avant
        Plotly.newPlot($("#graphFlowSimulatedExtend")[0], _traces, _layout, {
          responsive: false,
          modeBarButtonsToRemove: ["toggleSpikelines", "zoomIn2d", "zoomOut2d"],
          scrollZoom: true
        });
    }

    function timeProcessAlert(start, end, deltaT) {
        var launchProcess;
        var minutes;
        var secondes;
        // calcule la periode en jour
        period = (new Date(end) - new Date(start)) / 86400000;
        // si l'interval de temps = horaire et plus d'un an
        if (deltaT == 60 && period > 3650) {
            // translate
            if (mviewer.lang.lang == "en") {
                launchProcess = confirm("The treatment will take a long time (1min30s), please do not stop the script if it offers, would you like to continue ?");
            } else {
                launchProcess = confirm("Le traitement va prendre du temps (1min30s), veuillez ne pas arrêter le script s'il le propose, souhaitez-vous continuer ?");
            }
            if (launchProcess) {
                return true;
            } else {
                return false;
            }
        } else {
            return true;
        }
        // plus nécessaire avec les inversions stockées
        // si l'intervalle de temps est journalier
        // } else if (deltaT == 1440) {
        //     // estime le temps de traitement en prenant en reference 20s pour 1 an
        //     // au pas de temps journalier. Coef directeur de 0.013 en prenant A(0,25) B(7300,120)
        //     timeProEstimated = 0.013 * period + 25;
        //      // si le temps de traitement est superieur à 5min
        //     // affiche une alerte
        //     minutes = Math.floor(timeProEstimated / 60);
        //     secondes = (timeProEstimated - minutes * 60).toFixed(0);
        //     if (secondes.length == 1){secondes = "0"+secondes;}
        //     if (timeProEstimated > 60) {
        //         launchProcess = confirm(String.format(["Le temps de traitement sera d'environ {0}:{1} minutes, souhaitez-vous lancer la simulation ?"].join(""), minutes, secondes));
        //         if (launchProcess){
        //             return true;
        //         } else {
        //             return false;
        //         }
        //     } else {
        //         return true;
        //     }
    }

    function startTimer(duration, display) {
        var timer = duration,
            minutes, seconds;
        _countdown = setInterval(function () {
            minutes = parseInt(timer / 60, 10);
            seconds = parseInt(timer % 60, 10);

            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;

            display.textContent = minutes + ":" + seconds;

            if (--timer < 0) {
                // translate
                if (mviewer.lang.lang == "en") {
                    $("#countdown").text("Please wait...");
                } else {
                    $("#countdown").text("Veuillez patienter...");
                }
                clearInterval(_countdown);
            }
        }, 1000);
    }

    return {
        /*
         * Public
         */
        init: function () {
            // mandatory - code executed when panel is opened
            $(".list-group-item.mv-layer-details.draggable[data-layerid='baie'] .row.layerdisplay-legend").hide();
            $(".mv-layer-options[data-layerid='baie'] .form-group-opacity").hide();




          },
        dessin_baie : function () {
            if (_processing === false) {

                if (!_draw) {
                    var curseur = new ol.style.Style({
                        image: new ol.style.RegularShape({
                            stroke: new ol.style.Stroke({
                            color: 'red',
                            width: 1
                        }),
                        points: 4,
                        radius1: 15,
                        radius2: 1
                        }),
                    });
                    polygonSelection = new ol.layer.Vector({
                        source: new ol.source.Vector({
                        })
                    });

                    _draw = new ol.interaction.Draw({
                        source: polygonSelection.getSource(),
                        type: 'Point',
                        style:curseur
                    });
                    _map.addLayer(polygonSelection);
                    _draw.on('drawend', function (event) {
                        _xy = ol.proj.transform(event.feature.getGeometry().getCoordinates(), 'EPSG:3857', 'EPSG:2154');
                        var template = '{x},{y}';
                        coord = ol.coordinate.format(_xy, template);
                        // si le point clique dans la zone n'est pas dans le projet, ne lance pas le service
                        if (insideProjectArea(String(_xy).split(',')[0], String(_xy).split(',')[1]) === true) {
                            //nommer le point ?
                        } else {
                            // translate
                            if (mviewer.lang.lang == "en") {
                                Swal.fire({
                                    icon: 'warning',
                                    title: 'Warning',
                                    text: "Please click in the SIMFEN project area",
                                });

                            } else {
                                Swal.fire({
                                    icon: 'warning',
                                    title: 'Attention',
                                    text: "Veuillez cliquer dans la zone du projet SIMFEN",
                                });
                            }
                        }
                    });
                    mviewer.getMap().addInteraction(_draw);
                } else {
                    // translate
                    if (mviewer.lang.lang == "en") {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Warning',
                            text: "You have already activated the tool, please click on the map",
                        });
                    } else {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Attention',
                            text: "Vous avez déjà activé l'outil, veuillez cliquer sur la carte",
                        });
                    }
                }
            } else {
                // translate
                if (mviewer.lang.lang == "en") {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Please wait until the end of the process before running a new one, if the process is locked refresh the page",
                    });

                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Veuillez attendre la fin du process avant d'en exécuter un nouveau, si vous êtes bloqué actualiser la page",
                    });
                }
            }
        },
        simulation_baie : function () {
            _map.removeInteraction(_draw)
            var features = polygonSelection.getSource().getFeatures();
            var xy = [];
            features.forEach(function(feature) {

                _xy = ol.proj.transform(feature.getGeometry().getCoordinates(), 'EPSG:3857', 'EPSG:2154');
                var template = '{x}-{y}';
                coord = ol.coordinate.format(_xy, template);
                xy.push(coord)
             });

            xy=xy.toString()
            var dictInputs = {
                XYs: xy,
                Start: $("#dateStartWaterFlowSimulation").val(),
                End: $("#dateEndWaterFlowSimulation").val(),
                Project: $("#selectProjectInversion").val(),
                DeltaT: $("input[name='deltaTWaterFlowSimulation']:checked").val()
            };
            launchProcess = timeProcessAlert(dictInputs.Start, dictInputs.End, dictInputs.DeltaT);
            if (launchProcess) {
                // dismiss button appear
                $("#dismiss").toggleClass("hidden");

                // construit la requete xml POST
                _rqtWPS = buildPostRequest(dictInputs, _identifierBaie);
                console.log(_rqtWPS);
                // supprime les resultats du precedent process
                if ($("#graphFlowSimulated").children().first()) {
                  $("#divPopup1").children().remove();
                }
                if ($("#graphFlowSimulated").children().first()) {
                    $("#graphFlowSimulated").children().first().remove();
                    $("#graphFlowSimulatedExtend").children().first().remove();
                    $("#divPopup2").children().remove();
                    $("#divPopup4").children().remove();
                    $("#divPopup5").children().remove();
                }
                // defini des valeurs globales dans le cas d'une reexecution
                // si le process posse en file d'attente et execute le process
                _refreshTime = 3000;
                _timeOut = 100000;

                //periodAvailable = (new Date($("#dateEndWaterFlowSimulation").attr("max")) - new Date($("#dateStartWaterFlowSimulation").attr("min"))) / 86400000;
                _timerCountdown = 40;

                _display = document.querySelector('#countdown');
                // supprimer les couches
                deleteLayers(["Watersheds", "StationsAvailable", "StationsSelected"]);
                processingBarUpdate(0, "Initialisation");
                processExecution();
                _processing = true;

                //supprime les stations selectionnees et la couche de stations à choisir
                _stationsSelectedByUser = "None";

                // affiche le panneau de resultat
                if ($("#bottom-panel").hasClass("")) {
                    $("#bottom-panel").toggleClass("active");
                }
                $(".btn").blur();
            }
        }
    };
}());
