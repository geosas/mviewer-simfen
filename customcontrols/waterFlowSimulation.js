mviewer.customControls.waterFlowSimulation = (function () {
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
    var _identifier = "waterFlowSimulation";
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
    var selection1
    var select
    var note=0
    var targetArea
    var key_gap
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

                                if (outputTag.Identifier === "XY") {
                                    _xy = outputTag.Data.LiteralData.split(" ");
                                    if (Number(_xy[0]) == 0 && Number(_xy[1]) == 0) {
                                        // translate
                                        if (mviewer.lang.lang == "en") {
                                            Swal.fire({
                                                icon: 'error',
                                                title: 'Error',
                                                text: "The indicated coordinate has an altitude of 0, no simulation possible. Please indicate a point further upstream",

                                            });

                                        } else {
                                            Swal.fire({
                                                icon: 'error',
                                                title: 'Erreur',
                                                text: "La coordonnée indiquée possède une altitude de 0, aucune simulation possible. Veuillez indiquer un point plus en amont",
                                            });
                                        }
                                    } else {
                                        mviewer.showLocation('EPSG:2154', Number(_xy[0]), Number(_xy[1]));
                                    }
                                    _processing = false;

                                } else if (outputTag.Identifier === "StationsAvailable") {
                                    plotStationAvailable(outputTag.Data.ComplexData.FeatureCollection.featureMember);
                                    _processing = false;

                                } else if (outputTag.Identifier === "SimulatedFlow") {
                                    //plotDatas(outputTag.Data.ComplexData.Collection.observationMember.OM_Observation.result.MeasurementTimeseries.point);
                                    plotDatas(outputTag.Data.ComplexData);
                                    // translate
                                    var text;
                                    if (mviewer.lang.lang == "en") {
                                        text = "View measured flows used";
                                    } else {
                                        text = "Afficher les débits mesurés employés";
                                    }
                                    // ajoute le bouton pour afficher les debits mesures employes

                                    $("#bottom-panel .popup-content #toolsBoxPopup #divPopup2").append(["<div id='btnMeasuredFlow' style='padding-top:10px;position:absolute;'>",
                                        "<button class='btn btn-default' type='button'",
                                        "onclick='mviewer.customControls.waterFlowSimulation.getMeasuredFlow();'>",
                                        String.format("{0}</button></div>",text)
                                    ].join(""));

                                    _processing = false;

                                } else if (outputTag.Identifier === "StationsSelected") {
                                    plotStation(outputTag.Data.ComplexData.FeatureCollection.featureMember);
                                    _processing = false;

                                } else if (outputTag.Identifier === "Watersheds") {
                                    plotWatersheds(outputTag.Data.ComplexData.FeatureCollection.featureMember);
                                    _processing = false;

                                } else if (outputTag.Identifier === "TargetWatershed") {
                                    plotTargetWatershed(outputTag.Data.ComplexData.FeatureCollection.featureMember);
                                    _processing = false;

                                } else if (outputTag.Identifier === "MeasuredFlow") {
                                    plotMeasuredFlow(outputTag.Data.ComplexData);
                                    // supprime le bouton
                                    $("#divPopup2").children().first().remove();
                                    _processing = false;
                                } else if (outputTag.Identifier === "Obstacle") {
                                    plotObstacle(outputTag.Data.ComplexData);
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
        $("#dateStartWaterFlowSimulation").attr("min", dateMinSim);
        $("#dateStartWaterFlowSimulation").attr("max", dateMaxSim);

        // Defini une valeur par defaut où 50% des stations existent
        if (_initProject == "archives_dreal"){$("#dateStartWaterFlowSimulation").val("1984-01-01");

        } else {$("#dateStartWaterFlowSimulation").val(dateMinSim);}

        $("#dateEndWaterFlowSimulation").attr("min", dateMinSim);
        $("#dateEndWaterFlowSimulation").attr("max", dateMaxSim);
        $("#dateEndWaterFlowSimulation").val(dateMaxSim);
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

    // function setOutFiles(datasx, datasy) {
    //     // header of csvfile
    //     var str = "date;runoff(m3/s)" + "\r\n";

    //     // construit chaque ligne du csv selon les donnees
    //     for (var i = 0; i < datasx.length; i++) {
    //         var line = '';
    //         line += datasx[i] + ";" + datasy[i];
    //         str += line + '\r\n';
    //     }

    //     // cree le csv
    //     var blob = new Blob([str], {
    //         type: "text/csv"
    //     });
    //     var url = URL.createObjectURL(blob);

    //     // cree l'url de telechargement et lie le fichier blob a celui-ci
    //     // et l'ajoute dans le tableau de bord
    //     var glyphiconSave = document.createElement("span");
    //     glyphiconSave.setAttribute("class", "glyphicon glyphicon-save");

    //     var dlFile = document.createElement("a");
    //     dlFile.setAttribute("id", "linkDownloadFlow");
    //     dlFile.setAttribute("href", url);
    //     dlFile.setAttribute("target", "_blank");
    //     dlFile.setAttribute("style", "color:#337ab7;font-family:inherit;display:block;font-size:20px;");
    //     if ($("#identifiantSimulation").val()) {
    //         dlFile.setAttribute("download", String.format("{0}_debit.csv", $("#identifiantSimulation").val()));
    //     } else {
    //         dlFile.setAttribute("download", "output_simulation.csv");
    //     }
    //     // translate
    //     var text;
    //     if (mviewer.lang.lang == "en") {
    //         text = "Water flow simulated ";
    //     } else {
    //         text = "Débits simulés ";
    //     }
    //     dlFile.appendChild(document.createTextNode(text));
    //     $("#divPopup1").append(dlFile);
    //     $("#linkDownloadFlow").append(glyphiconSave);

    //     setOutMetadata();

    //     // duplication obligatoire, impossible d'ajouter la meme icone
    //     // 2 fois, la suivante remplace l'ancienne, a creuser
    //     var glyphiconSave2 = document.createElement("span");
    //     glyphiconSave2.setAttribute("class", "glyphicon glyphicon-save");

    //     var licenceFile = document.createElement("a");
    //     licenceFile.setAttribute("id", "linkLicence");
    //     licenceFile.setAttribute("target", "_blank");
    //     licenceFile.setAttribute("style", "color:#337ab7;font-family:inherit;display:block;font-size:20px;");
    //     licenceFile.setAttribute("href", "http://geowww.agrocampus-ouest.fr/apps/simfen-dev/licence_simulation.txt");
    //     if ($("#identifiantSimulation").val()) {
    //         licenceFile.setAttribute("download", String.format("{0}_licence.txt", $("#identifiantSimulation").val()));
    //     } else {
    //         licenceFile.setAttribute("download", "licence_simulation.txt");
    //     }
    //     // translate
    //     if (mviewer.lang.lang == "en") {
    //         text = "Disclaimer ";
    //     } else {
    //         text = "Licence d'utilisation ";
    //     }
    //     licenceFile.appendChild(document.createTextNode(text));
    //     $("#divPopup1").append(licenceFile);
    //     $("#linkLicence").append(glyphiconSave2);

    // }

    // function setOutMetadata() {
    //     listStations = "";
    //     for (var i = 0; i < _nameColor.length; i++) {
    //         listStations += _nameColor[i].key + ",";
    //     }
    //     listStations = listStations.substring(0, listStations.length - 1);

    //     // translate
    //     if (mviewer.lang.lang == "en") {
    //         var str = "x;y;start;end;stations;timestep;hydrographic network" + "\r\n";
    //     } else {
    //         var str = "x;y;debut;fin;stations;pas de temps;réseau hydrographique" + "\r\n";
    //     }
    //     var period;
    //     if ($("input[name='deltaTWaterFlowSimulation']:checked").val() == 1440) {
    //         // translate
    //         if (mviewer.lang.lang == "en") {
    //             period = "daily";
    //         } else {
    //             period = "journalier";
    //         }
    //     } else if ($("input[name='deltaTWaterFlowSimulation']:checked").val() == 60) {
    //         // translate
    //         if (mviewer.lang.lang == "en") {
    //             period = "hourly";
    //         } else {
    //             period = "horaire";
    //         }
    //     }
    //     // translate
    //     var hydroNetwork;
    //     if (mviewer.lang.lang == "en") {
    //         hydroNetwork = "modeled hydrographic network thresholded at 25 ha (DEM 50m)";
    //     } else {
    //         hydroNetwork = "réseau hydrographique modélisé seuillé à 25ha (MNT 50m)";
    //     }
    //     str += String.format("{0};{1};{2};{3};{4};{5};{6}",
    //         _xy[0],
    //         _xy[1],
    //         $("#dateStartWaterFlowSimulation").val(),
    //         $("#dateEndWaterFlowSimulation").val(),
    //         listStations,
    //         period,
    //         hydroNetwork);
    //     // cree le csv
    //     var blob = new Blob([str], {
    //         type: "text/csv"
    //     });
    //     var url = URL.createObjectURL(blob);

    //     // logo telechargement
    //     var glyphiconSave = document.createElement("span");
    //     glyphiconSave.setAttribute("class", "glyphicon glyphicon-save");

    //     var metaFile = document.createElement("a");
    //     metaFile.setAttribute("id", "linkMetadata");
    //     metaFile.setAttribute("target", "_blank");
    //     metaFile.setAttribute("style", "color:#337ab7;font-family:inherit;display:block;font-size:20px;");
    //     metaFile.setAttribute("href", url);
    //     if ($("#identifiantSimulation").val()) {
    //         metaFile.setAttribute("download", String.format("{0}_metadonnees.csv", $("#identifiantSimulation").val()));
    //     } else {
    //         metaFile.setAttribute("download", "metadonnee_simulation.csv");
    //     }
    //     // translate
    //     var text;
    //     if (mviewer.lang.lang == "en") {
    //         text = "Metadata of simulation ";
    //     } else {
    //         text = "Métadonnée de simulation ";
    //     }
    //     metaFile.appendChild(document.createTextNode(text));
    //     $("#divPopup1").append(metaFile);
    //     $("#linkMetadata").append(glyphiconSave);
    // }

    function setOutputFile(datasx, datasy){
        // Fonction pour generer le document de reponse contenant
        // la licence, les metadonnees de calcul et la simulation

        // Header of csvfile = Licence in panelDisclaimer
        var outFile = $("[i18n='panelDisclaimer']").text() + "\r\n";

        // Append calculation metadata
        listStations = "";
        for (var i = 0; i < _nameColor.length; i++) {
            listStations += _nameColor[i].key + ",";
        }
        listStations = listStations.substring(0, listStations.length - 1);

        var metadonneesCalcul;
        // translate
        if (mviewer.lang.lang == "en") {
            metadonneesCalcul = "x;y;start;end;stations;timestep;hydrographic-network;target-catchment-area-km2" + "\r\n";
        } else {
            metadonneesCalcul = "x;y;debut;fin;stations;pas-de-temps;réseau-hydrographique;aire-bassin-versant-cible-km2" + "\r\n";
        }
        var period;
        if ($("input[name='deltaTWaterFlowSimulation']:checked").val() == 1440) {
            // translate
            if (mviewer.lang.lang == "en") {
                period = "daily";
            } else {
                period = "journalier";
            }
        } else if ($("input[name='deltaTWaterFlowSimulation']:checked").val() == 60) {
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
        metadonneesCalcul += String.format("{0};{1};{2};{3};{4};{5};{6};{7}" ,
            _xy[0],
            _xy[1],
            $("#dateStartWaterFlowSimulation").val(),
            $("#dateEndWaterFlowSimulation").val(),
            listStations,
            period,
            hydroNetwork,
            Math.round(targetArea*100)/100) + "\r\n";


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

    function plotDatas(points) {
        //rajout pour json
        // notation des stations et des obstacles
        if (mviewer.lang.lang == "en") {
            if (targetArea<10){
                codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p style='color:red'>The surface of the watershed is too small to perform a correct simulation. Use the results with caution.</font></p></div>";
            } else if (Math.round(note)===1){
                codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p>Local influence of the hydrometric station <span style='color:green'>None or low</span></p></div>";
            } else if (Math.round(note)===2){
                codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p>Local influence of the hydrometric station <span style='color:orange'>Notable</span></p></div>";
            } else if (Math.round(note)===3){
                codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p>Local influence of the hydrometric station <span style='color:red'>Strong</span></p></div>";
            } else {
                codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p>Error in the scoring of source stations </p></div>";
            }

            $("#bottom-panel .popup-content #toolsBoxPopup #divPopup4").append([codeRegime]);
        } else {
            if (targetArea<10){
                codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p style='color:red'>La surface du bassin versant est trop petite pour réaliser une simulation correcte. Utiliser les résultats avec prudence.</font></p></div>";
            } else if (Math.round(note)===1){
                codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p>Influence locale de la station hydrométrique <span style='color:green'>Nulle ou faible</span></p></div>";
            } else if (Math.round(note)===2){
                codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p>Influence locale de la station hydrométrique <span style='color:orange'>Notable</span></p></div>";
            } else if (Math.round(note)===3){
                codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p>Influence locale de la station hydrométrique <span style='color:red'>Forte</span></p></div>";
            } else {
                codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p>Erreur dans la notation des stations sources </p></div>";
            }

            $("#bottom-panel .popup-content #toolsBoxPopup #divPopup4").append([codeRegime]);
        }

        var datasJson = JSON.parse(points);
        var xDatas = [];
        var yDatas = [];
        for (var i = 0; i < datasJson.length; i++) {
            xDatas.push(datasJson[i][0]);
            yDatas.push(datasJson[i][1]);

            //si fichier en waterml code si dessous, mais le json est beaucoup plus leger (le navigateur ne plante pas)
            //push plus rapide que concat (le navigateur ne plante pas)
            //xDatas.push(datasJson[i].date);
            //yDatas.push(datasJson[i].debit);
            //xDatas.push(points[i].MeasurementTVP.time);
            //yDatas.push(points[i].MeasurementTVP.value);
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

    function plotMeasuredFlow(datas) {

        var datasJson = JSON.parse(datas);
        var trace;
        for (i = 0; i < _nameColor.length; i++) {
            var xDatas = [];
            var yDatas = [];
            for (var j = 0; j < datasJson.length; j++) {
                if (_nameColor[i].key === datasJson[j].station) {
                    //xDatas = xDatas.concat(datasJson[j].date);
                    //yDatas = yDatas.concat(datasJson[j].measuredFlow);
                    xDatas.push(datasJson[j].date);
                    yDatas.push(datasJson[j].measuredFlow);
                    //si highcharts conversion en ms de la date
                    //data_flow.push([new Date((datasJson[j].date)).getTime(),parseFloat(datasJson[j].measuredFlow)])
                }
            }
            //scattergl Implement WebGL for increased speed
            trace = {
                name: _nameColor[i].key,
                x: xDatas,
                y: yDatas,
                mode:"lines",
                type: "scattergl",
                line: {
                    color: _nameColor[i].value
                },
                connectgaps: 'false'
                };
        _traces.push(trace);
        }


        // alerte l'utilisateur si le serveur wfs repond mais ne renvoie pas de données pour toutes les stations
        if (_traces.length < _nameColor.length){
            if (mviewer.lang.lang == "en") {

            Swal.fire({
                icon: 'warning',  title: "Show flow rate :",
                text: "The external data source has a problem, switch to advanced mode and use the bank hydro flow source.",
                confirmButtonColor: '#2e5367',
                confirmButtonText: "Ok",
            });
          } else {

            Swal.fire({
                icon: 'warning',  title: "Affichage des débits :",
                text: "La source externe des données à rencontrée un problème , passez en mode avancé et utilisez la source de débit banque hydro.",
                confirmButtonColor: '#2e5367',
                confirmButtonText: "Ok",
            });
          }

        }
        // utilisation de newplot car plot et addtraces dupliquent la legende
        // sur le second graphique
        // plotly react est ne pose pas ce probleme et est plus efficient
        Plotly.react($("#graphFlowSimulated")[0], _traces, _layout, {
            responsive: false,
            modeBarButtonsToRemove: ["toggleSpikelines", "zoomIn2d", "zoomOut2d"],
            scrollZoom: true
        });

        // duplication des graphiques et utilisation de la classe hidden (visibility) car
        // plotly.relayout pose soucis, impossible de depasser 450px de height et impossible
        // de revenir a l'etat d'avant
        Plotly.react($("#graphFlowSimulatedExtend")[0], _traces, _layout, {
          responsive: false,
          modeBarButtonsToRemove: ["toggleSpikelines", "zoomIn2d", "zoomOut2d"],
          scrollZoom: true
        });
    }

    function plotStationAvailable(features) {
        /*recupere dans le document xml les informations spatiales des stations
        pour ensuite les afficher sur la carte. Si une couche de station a deja ete
        produite, la supprime avant*/

        function pointStyleFunctionSelected(feature) {

            var couleur_qualite;

            if(feature.get('qualite') === '1') {
                couleur_qualite="#27df32";
            } else if(feature.get('qualite') === '2') {
                couleur_qualite="orange";
            } else if(feature.get('qualite') === '3') {
                couleur_qualite="red";
            } else if(feature.get('qualite') === '0') {
                couleur_qualite="#2e5367";
            }

            if(parseInt(feature.get('duree')) > '365') {
                stl = [new ol.style.Style({
                    image:  new ol.style.RegularShape({
                    fill: new ol.style.Fill({
                        color: couleur_qualite,
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'black',
                        width: 3
                    }),
                    points: 3,
                    radius: 15,
                    angle: 0,

                    }),
                    text: createTextStyle(feature)
                }),
                new ol.style.Style({
                    image: new ol.style.RegularShape({
                        fill: new ol.style.Fill({color: 'black'}),
                        stroke: new ol.style.Stroke({color: 'black', width: 3}),
                        points: 4,
                        radius: 6,
                        radius2: 0,
                        angle: Math.PI / 4
                    })
                })
                ];

                return stl;

            } else {

                stl = new ol.style.Style({
                    image: new ol.style.RegularShape({
                        fill: new ol.style.Fill({color: couleur_qualite}),
                        stroke: new ol.style.Stroke({
                            color: 'black',
                            width: 3
                        }),
                        points: 3,
                        radius: 15,
                        angle: 0,
                    }),
                    text: createTextStyle(feature)
                });

                return stl;}
            }





        var createTextStyle = function (feature) {
            return new ol.style.Text({
                font: '12px Calibri,sans-serif',
                text: feature.get('date_min').substr(0, 10)+"\n"+feature.get('date_max').substr(0, 10)+"\n"+feature.get('name'),
                offsetY: 40,
                fill: new ol.style.Fill({
                    color: '#000'
                }),
                stroke: new ol.style.Stroke({
                    color: '#fff',
                    width: 7
                })
            });
        };

        // initialise la source de donnees qui va contenir les entites
        var stationSource = new ol.source.Vector({});

        // cree le vecteur qui va contenir les stations
        var arrStations = [];
        var _stationLayer = new ol.layer.Vector({
            name: "StationsAvailable",
            source: stationSource,
            style: pointStyleFunctionSelected,
        });
        //si une station (cas de agrhys par exemple)
        if (features.length == null) {

            coord =features.sql_statement.geom.Point.coordinates.split(",");
            nameStation = features.sql_statement.station;
            qualitat=features.sql_statement.qualite;
            date_minimum=features.sql_statement.min;
            date_maximum=features.sql_statement.max;
            trou_sql=features.sql_statement.gap;
            duree_trou=features.sql_statement.somme_gap;
            arrStations.push(nameStation);

            // cree le point en veillant a changer la projection
            var featureGeom = new ol.geom.Point(ol.proj.transform([coord[0], coord[1]], 'EPSG:2154', 'EPSG:3857'));
            // cree la feature
            var featureThing = new ol.Feature({
                name: nameStation,
                geometry: featureGeom,
                qualite: qualitat,
                date_min: date_minimum,
                date_max: date_maximum,
                trou: trou_sql,
                duree: duree_trou,
            });
            // ajoute la feature a la source
            stationSource.addFeature(featureThing);


        } else {
            // pour chaque entite
            for (var j = 0; j < features.length; j++) {
                // recupere sa coordonnees et son nom
                // passer par une base de donnees permet de normaliser le nom de la couche, qu'importe les services
                coord = features[j].sql_statement.geom.Point.coordinates.split(",");
                nameStation = features[j].sql_statement.station;
                qualitat=features[j].sql_statement.qualite;
                date_minimum=features[j].sql_statement.min;
                date_maximum=features[j].sql_statement.max;
                trou_sql=features[j].sql_statement.gap;
                duree_trou=features[j].sql_statement.somme_gap;
                arrStations.push(nameStation);

                // cree le point en veillant a changer la projection
                var featureGeom = new ol.geom.Point(ol.proj.transform([coord[0], coord[1]], 'EPSG:2154', 'EPSG:3857'));
                // cree la feature
                var featureThing = new ol.Feature({
                    name: nameStation,
                    geometry: featureGeom,
                    qualite: qualitat,
                    date_min: date_minimum,
                    date_max: date_maximum,
                    trou: trou_sql,
                    duree: duree_trou,
                });
                // ajoute la feature a la source
                stationSource.addFeature(featureThing);
            }
        }

        // ajoute la couche de point des stations a la carte
        _map.addLayer(_stationLayer);

        var info = document.getElementById('divPopup1');
        info.innerHTML = "<img src='/apps/simfen-test/data/lgd_regime.png' alt='Légende régimes des stations'>";

        // permet de déclencher l'alerte contenant les infos complémentaires en cliquant sur la station
        var displayFeatureInfo = function(pixel) {

            var feature = _map.forEachFeatureAtPixel(pixel, function(feature) {
                return feature;
            });

            if (feature) {
                Swal.fire({
                    title: feature.get('name')+" données manquantes :",
                    html: feature.get('trou'),
                    confirmButtonColor: '#2e5367',
                    confirmButtonText: "Ok",
                });
            };
        };

        function show_info(){
            var evtKey=_map.on('click', function(evt) {
                if (evt.dragging) {
                    return;
                };
            var pixel = _map.getEventPixel(evt.originalEvent);
            displayFeatureInfo(pixel);
            });
            return evtKey;
        };

        key_gap =show_info();
    }

    function plotTargetWatershed(features) {


        function styleFunction(feature) {
            return new ol.style.Style({
                stroke: new ol.style.Stroke({
                    width: 3,
                    color: "black"
                }),
                text: styleWatershed(feature)
            });
        };

        var styleWatershed = function (feature) {
            // translate
            var text;

            if (mviewer.lang.lang == "en") {
                label = "Target basin\n"+Math.round(targetArea*100)/100+" km2";
            } else {
                label = "Bassin cible\n"+Math.round(targetArea*100)/100+" km2";
            };

            return new ol.style.Text({
                font: '12px Calibri,sans-serif',
                text: label,
                offsetY: 20,
                fill: new ol.style.Fill({
                    color: "black"
                }),
                stroke: new ol.style.Stroke({
                    color: '#fff',
                    width: 5
                })
            });
        };

        function addWatershed(coords, nameWatershed, watershedsSource, area) {
            // cree le point en veillant a changer la projection
            polyCoords = [];
            for (var i in coords) {
                var c = coords[i].split(',');
                polyCoords.push(ol.proj.transform([parseFloat(c[0]), parseFloat(c[1])], 'EPSG:2154', 'EPSG:3857'));
            };
            // cree la feature

            var feature = new ol.Feature({
                name: nameWatershed,
                geometry: new ol.geom.Polygon([polyCoords]),
                label: area,

            });

            //alerte pour la taille des bassins versants
            targetArea=ol.sphere.getArea(feature.getGeometry())/1000000;

            if (targetArea<10){
                if (mviewer.lang.lang == "en") {

                    Swal.fire({
                        icon: 'warning',  title: "Area = "+Math.round(targetArea*100)/100+" km2",
                        text: "The watershed area is less than 10km2, the results will not reflect the reality",
                        showCancelButton: true,
                        confirmButtonColor: '#2e5367',
                        cancelButtonColor: '#d58c0c',
                        confirmButtonText: "Change outlet",
                        cancelButtonText: 'Continue',
                    }).then((result) => {
                        if (result.value) {
                            _processing = false;
                            _draw = "";
                            mviewer.customControls.waterFlowSimulation.getXY();
                        }
                    })
                } else {

                    Swal.fire({
                        icon: 'warning',  title: "Surface = "+Math.round(targetArea*100)/100+" km2",
                        text: "La surface du bassin versant est inférieure à 10km2, les résultats ne seront pas optimaux",
                        showCancelButton: true,
                        confirmButtonColor: '#2e5367',
                        cancelButtonColor: '#d58c0c',
                        confirmButtonText: "Changer l'exutoire",
                        cancelButtonText: 'Continuer',
                    }).then((result) => {
                        if (result.value) {
                            _processing = false;
                            _draw = "";
                            mviewer.customControls.waterFlowSimulation.getXY();
                        }
                    })
                }
            };

            // ajoute la feature a la source
            watershedsSource.addFeature(feature);
        };

        // initialise la source de donnees qui va contenir les entites
        var watershedsSource = new ol.source.Vector({});

        // cree le vecteur qui va contenir les bassins versants
        var _watershedsLayer = new ol.layer.Vector({
            name: "TargetWatershed",
            source: watershedsSource,
            style: styleFunction
        });
        //fonction pour télécharger le bassin versant cible
        _watershedsLayer.getSource().on('change', function(evt){
            if (mviewer.lang.lang == "en") {
                $("#bottom-panel .popup-content #toolsBoxPopup #divPopup4").append(["<a  style='background-color:#2e5367' class='btn btn-primary' id='download'>Download the target watershed</a>"])
            } else {
                $("#bottom-panel .popup-content #toolsBoxPopup #divPopup4").append(["<a  style='background-color:#2e5367' class='btn btn-primary' id='download'>Télécharger le bassin versant cible</a>"])
            };

        let format = new ol.format.GeoJSON({featureProjection: 'EPSG:3857'});
        let download = document.getElementById('download');
        let features = _watershedsLayer.getSource().getFeatures();
        let json = format.writeFeatures(features);
        download.href = 'data:text/json;charset=utf-8,' + json;
        download.download='Bassin versant cible.json'

        });


        // s'il n'y a qu'une feature/station
        if (features.length == null) {
            try {
                coord = features.bv.geometryProperty.Polygon.outerBoundaryIs.LinearRing.coordinates.split(' ');
                nameWatershed = features.bv.station;
                area=0;
                addWatershed(coord, nameWatershed, watershedsSource, area);
            } catch (error) {
                multiPolygons = features.bv.geometryProperty.MultiPolygon.polygonMember;
                for (i = 0; i < multiPolygons.length; i++) {
                    coord = multiPolygons[i].Polygon.outerBoundaryIs.LinearRing.coordinates.split(' ');
                    nameWatershed = features.bv.station;
                    area = 0;
                    addWatershed(coord, nameWatershed, watershedsSource, area);
                }
            };
        } else {
            // s'il y en a plusieurs
            for (var j = 0; j < features.length; j++) {
                try {
                    coord = features[j].bv.geometryProperty.Polygon.outerBoundaryIs.LinearRing.coordinates.split(' ');
                    nameWatershed = features[j].bv.station;
                    area = 0;
                    addWatershed(coord, nameWatershed, watershedsSource, area);
                } catch (error) {
                    polygonsWatershed = features[j].bv.geometryProperty.MultiPolygon.polygonMember;
                    for (i = 0; i < polygonsWatershed.length; i++) {
                        coord = polygonsWatershed[i].Polygon.outerBoundaryIs.LinearRing.coordinates.split(' ');
                        nameWatershed = features[j].bv.station;
                        area = 0;
                        addWatershed(coord, nameWatershed, watershedsSource, area);
                    }
                }
            };
        }
        // ajoute la couche de point des stations a la carte
        _map.addLayer(_watershedsLayer);
    }

    function plotWatersheds(features) {
        // variable pour assigner une couleur a une station
        _nameColor = [];

        function styleFunction(feature) {
            // assigne un identifiant a une couleur
            var colorWatershed;
            for (var i = 0; i < _nameColor.length; i++) {
                if (feature.get('name') === _nameColor[i].key) {
                    colorWatershed = _nameColor[i].value;
                }
            }
            return new ol.style.Style({
                stroke: new ol.style.Stroke({
                    width: 3,
                    color: colorWatershed
                }),
                text: createTextStyleWatershed(feature, colorWatershed)
            });
        };

        var createTextStyleWatershed = function (feature, colorWatershed) {
            if (feature.get('weight') != 0) {
                // translate
                if (mviewer.lang.lang == "en") {
                    label = feature.get('label') + "km2\nweight:" + feature.get('weight');
                } else {
                    label = feature.get('label') + "km2\npoids:" + feature.get('weight');
                }
            } else {
                label = ""//"\n\n"+feature.get('label') + "km2";
            };
            return new ol.style.Text({
                font: '12px Calibri,sans-serif',
                text: label,
                offsetY: 20,
                fill: new ol.style.Fill({
                    color: colorWatershed
                }),
                stroke: new ol.style.Stroke({
                    color: '#fff',
                    width: 5
                })
            });
        };

        function addWatershed(coords, nameWatershed, watershedsSource, area, wghosh) {
            // cree le point en veillant a changer la projection
            polyCoords = [];
            for (var i in coords) {
                var c = coords[i].split(',');
                polyCoords.push(ol.proj.transform([parseFloat(c[0]), parseFloat(c[1])], 'EPSG:2154', 'EPSG:3857'));
            }

            // cree la feature
            var feature = new ol.Feature({
                name: nameWatershed,
                geometry: new ol.geom.Polygon([polyCoords]),
                label: area,
                weight: wghosh
            });
            // ajoute la feature a la source
            watershedsSource.addFeature(feature);
        }

        // initialise la source de donnees qui va contenir les entites
        var watershedsSource = new ol.source.Vector({});

        // cree le vecteur qui va contenir les stations
        var arrWatersheds = [];
        var _watershedsLayer = new ol.layer.Vector({
            name: "Watersheds",
            source: watershedsSource,
            style: styleFunction
        });

        // order features if more than one
        if (features.length > 2) {
            features = features.sort(function (a, b) {
                return parseFloat(a.bv.area) - parseFloat(b.bv.area);
            });
            features = features.reverse();
        }

        // s'il n'y a qu'une feature/station
        if (features.length == null) {
            try {
                coord = features.bv.geometryProperty.Polygon.outerBoundaryIs.LinearRing.coordinates.split(' ');
                nameWatershed = features.bv.station;
                area = features.bv.area;
                wghosh = features.bv.weights;

                if (parseFloat(features[j].bv.weights)==0){
                    note_barrage=parseInt(features[j].bv.qualite)
                }

                note=(parseInt(features[j].bv.qualite)*parseFloat(features[j].bv.weights));
                _nameColor.push({
                    key: nameWatershed,
                    value: _colors[0]
                });
                addWatershed(coord, nameWatershed, watershedsSource, area, wghosh);
            } catch (error) {
                multiPolygons = features.bv.geometryProperty.MultiPolygon.polygonMember;
                for (i = 0; i < multiPolygons.length; i++) {
                    coord = multiPolygons[i].Polygon.outerBoundaryIs.LinearRing.coordinates.split(' ');
                    nameWatershed = features.bv.station;
                    area = features.bv.area;
                    wghosh = features.bv.weights;

                    if (parseFloat(features[j].bv.weights)==0){
                        note_barrage=parseInt(features[j].bv.qualite)
                    }

                    note=(parseInt(features[j].bv.qualite)*parseFloat(features[j].bv.weights));
                    _nameColor.push({
                        key: nameWatershed,
                        value: _colors[0]
                    });
                    addWatershed(coord, nameWatershed, watershedsSource, area, wghosh);
                }
            }
        } else {
            // s'il y en a plusieurs
            z=0
            for (var j = 0; j < features.length; j++) {
                try {
                    coord = features[j].bv.geometryProperty.Polygon.outerBoundaryIs.LinearRing.coordinates.split(' ');
                    nameWatershed = features[j].bv.station;
                    area = features[j].bv.area;
                    wghosh = features[j].bv.weights;

                    if (parseFloat(features[j].bv.weights)==0){
                        note_barrage=parseInt(features[j].bv.qualite)
                    }

                    note+=(parseInt(features[j].bv.qualite)*parseFloat(features[j].bv.weights));
                    if (parseFloat(features[j].bv.weights)!=0){
                        _nameColor.push({
                            key: nameWatershed,
                            value: _colors[z]
                        });
                        z++;
                    }
                    addWatershed(coord, nameWatershed, watershedsSource, area, wghosh);
                } catch (error) {
                    polygonsWatershed = features[j].bv.geometryProperty.MultiPolygon.polygonMember;
                    for (i = 0; i < polygonsWatershed.length; i++) {
                        coord = polygonsWatershed[i].Polygon.outerBoundaryIs.LinearRing.coordinates.split(' ');
                        nameWatershed = features[j].bv.station;
                        area = features[j].bv.area;
                        wghosh = features[j].bv.weights;

                        if (parseFloat(features[j].bv.weights)==0){
                            note_barrage=parseInt(features[j].bv.qualite)
                        }

                        note+=(parseInt(features[j].bv.qualite)*parseFloat(features[j].bv.weights));
                        _nameColor.push({
                            key: nameWatershed,
                            value: _colors[j]
                        });
                        addWatershed(coord, nameWatershed, watershedsSource, area, wghosh);
                    }
                }
            }
        }
        // ajoute la couche de point des stations a la carte
        _map.addLayer(_watershedsLayer);

        var highlightStyle = new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: [46,83,103,0.6],
                width: 2
            }),
            fill: new ol.style.Fill({
                color: [46,83,103,0.2]
            }),
            zIndex: 1
        });

        // pour mettre en surbrillance les bv
        hoverBV = new ol.interaction.Select({
            condition: ol.events.condition.pointerMove,
            layers: [_watershedsLayer],
            style: highlightStyle
        });
        _map.addInteraction(hoverBV);
    }

    function plotStation(features) {
        /*recupere dans le document xml les informations spatiales des stations
        pour ensuite les afficher sur la carte. Si une couche de station a deja ete
        produite, la supprime avant*/

        // variable pour assigner une couleur a une station
        _nameColor = [];

        function pointStyleFunctionSelected(feature) {
            // assigne un identifiant a une couleur
            var colorStation;
            for (var i = 0; i < _nameColor.length; i++) {
                if (feature.get('name') === _nameColor[i].key) {
                    colorStation = _nameColor[i].value;
                }
            }

            return new ol.style.Style({
                image: new ol.style.RegularShape({
                    fill: new ol.style.Fill({
                        color: colorStation
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'black',
                        width: 2
                    }),
                    points: 3,
                    radius: 10,
                    angle: 0
                  }),
                text: createTextStyle(feature, colorStation)
            });
        }

        function addStation(coord, nameStation, stationSource) {
            // cree le point en veillant a changer la projection
            var featureGeom = new ol.geom.Point(ol.proj.transform([coord[0], coord[1]], 'EPSG:2154', 'EPSG:3857'));
            // cree la feature
            var featureThing = new ol.Feature({
                name: nameStation,
                geometry: featureGeom
            });
            // ajoute la feature a la source
            stationSource.addFeature(featureThing);
        }

        var createTextStyle = function (feature, colorStation) {
            return new ol.style.Text({
                font: '12px Calibri,sans-serif',
                text: feature.get('name'),
                offsetY: 20,
                fill: new ol.style.Fill({
                    color: colorStation
                }),
                stroke: new ol.style.Stroke({
                    color: '#fff',
                    width: 5
                })
            });
        };

        // initialise la source de donnees qui va contenir les entites
        var stationSource = new ol.source.Vector({});

        // cree le vecteur qui va contenir les stations
        var arrStations = [];
        var _stationLayer = new ol.layer.Vector({
            name: "StationsSelected",
            source: stationSource,
            style: pointStyleFunctionSelected
        });

        // s'il n'y a qu'une feature/station
        if (features.length == null) {
            coord = features.stations.geometryProperty.Point.coordinates.split(",");
            nameStation = features.stations.station;
            arrStations.push(nameStation);
            _nameColor.push({
                key: nameStation,
                value: _colors[0]
            });
            addStation(coord, nameStation, stationSource);

        } else {
            // s'il y en a plusieurs
            for (var j = 0; j < features.length; j++) {
                // recupere sa coordonnees et son nom
                coord = features[j].stations.geometryProperty.Point.coordinates.split(",");
                nameStation = features[j].stations.station;
                arrStations.push(nameStation);
                _nameColor.push({
                    key: nameStation,
                    value: _colors[j]
                });
                addStation(coord, nameStation, stationSource);
            }
        }
        // ajoute la couche de point des stations a la carte
        _map.addLayer(_stationLayer);
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

    function plotObstacle(datas) {

        if (targetArea>10){

            data_obs=JSON.parse(datas)
            nb_obs=data_obs.length
            aire_b=0
            data_obs.forEach(element => aire_b+=element.aire_km2);
            pourcentage=Math.round(aire_b/targetArea*100)
            if (nb_obs > 0){
                codeBarrage="<div id='notation2' style='font-size:20px'><p>Obstacle à l'écoulement (5m et +) dans BV cible : "+nb_obs+" ("+pourcentage+"% du BV cible)</p></div>";
                $("#bottom-panel .popup-content #toolsBoxPopup #divPopup4").append([codeBarrage]);
            }

        }

    }

    return {
        /*
         * Public
         */

        init: function () {
            // mandatory - code executed when panel is opened
            $(".list-group-item.mv-layer-details.draggable[data-layerid='waterFlowSimulation'] .row.layerdisplay-legend").hide();
            $(".mv-layer-options[data-layerid='waterFlowSimulation'] .form-group-opacity").hide();


            // Fonction pour afficher la coordonnee X,Y a la volee
            var mousePositionControl = new ol.control.MousePosition({
                coordinateFormat: ol.coordinate.createStringXY(0),
                projection: 'EPSG:2154',
                className: 'custom-mouse-position',
                target: document.getElementById('mouse-position'),
                undefinedHTML: 'EPSG : 2154'
            });
            mviewer.getMap().addControl(mousePositionControl);
            // Build wps request
            _rqtWPS = buildPostRequest({}, _identifierGetInfos);
            _timerCountdown = 2;
            _display = document.querySelector('#countdown');
            // set time processing
            _refreshTime = 1000;
            _timeOut = 10000;
            // dismiss button disappear
            $("#dismiss").toggleClass("hidden");
            processExecution();
            _processing = true;
        },

        setPeriodSimulation: function(project){
            for(var i = 0; i < _configurationInfos.length; i++){
                if(_configurationInfos[i][project]){
                    // substr a cause du format timestamp(Y-M-d H-M-S)
                    dateMinSim = _configurationInfos[i][project].datemin.substr(10,10);
                    dateMaxSim = _configurationInfos[i][project].datemax.substr(10,10);
                }
            }

            // Defini les dates de simulation possibles
            $("#dateStartWaterFlowSimulation").attr("min", dateMinSim);
            $("#dateStartWaterFlowSimulation").attr("max", dateMaxSim);
            $("#dateStartWaterFlowSimulation").val(dateMinSim);

            $("#dateEndWaterFlowSimulation").attr("min", dateMinSim);
            $("#dateEndWaterFlowSimulation").attr("max", dateMaxSim);
            $("#dateEndWaterFlowSimulation").val(dateMaxSim);
        },

        dismiss: function() {
            // dismiss button disappear
            $("#dismiss").toggleClass("hidden");

            // list of inputs
            var dictInputs = {
                uuid: _uuid
            };

            // Build wps request
            _rqtWPS = buildPostRequest(dictInputs, _identifierDismiss);

            // set time processing
            _refreshTime = 1000;
            _timeOut = 10000;

            // Execute process
            // var _processing already set true
            // Stop process refresh
            _xhrGet.abort();
            clearInterval(_updating);
            clearInterval(_countdown);
            processExecution();
        },

        getXY: function () {
            if (_processing === false) {
                if (key_gap != 0){
                    // désactive les fonctions liées à showAvailableStations
                    ol.Observable.unByKey(key_gap);
                    key_gap=0;
                }
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
                    _draw = new ol.interaction.Draw({
                        type: 'Point',
                        style:curseur
                    });
                    _draw.on('drawend', function (event) {
                        _xy = ol.proj.transform(event.feature.getGeometry().getCoordinates(), 'EPSG:3857', 'EPSG:2154');
                        mviewer.getMap().removeInteraction(_draw);
                        var template = '{x},{y}';
                        coord = ol.coordinate.format(_xy, template);

                        // si le point clique dans la zone n'est pas dans le projet, ne lance pas le service
                        if (insideProjectArea(String(_xy).split(',')[0], String(_xy).split(',')[1]) === true) {
                            // dismiss button appear
                            $("#dismiss").toggleClass("hidden");

                            // defini les parametres x,y du service
                            var dictInputs = {
                                X: String(_xy).split(',')[0],
                                Y: String(_xy).split(',')[1]
                            };
                            // construit la requete wps
                            _rqtWPS = buildPostRequest(dictInputs, _identifierXY);
                            // defini des valeurs globales dans le cas d'une reexecution
                            // si le process posse en file d'attente et execute le process
                            _refreshTime = 2000;
                            _timeOut = 100000;
                            _timerCountdown = 2;
                            _display = document.querySelector('#countdown');
                            // supprimer les couches
                            deleteLayers(["Watersheds", "StationsAvailable", "StationsSelected", "TargetWatershed"]);
                            processingBarUpdate(0, "Initialisation");
                            processExecution();
                            _processing = true;

                            // supprime les resultats du precedent process
                            if ($("#graphFlowSimulated").children().first()) {
                              $("#divPopup1").children().remove();
                            }

                            if ($("#graphFlowSimulated").children().first()) {
                                $("#graphFlowSimulated").children().first().remove();
                                $("#graphFlowSimulatedExtend").children().first().remove();
                                $("#divPopup2").children().first().remove();
                                $("#divPopup4").children().remove();
                            }

                            // affiche le panneau de resultat
                            if ($("#bottom-panel").hasClass("")) {
                                $("#bottom-panel").toggleClass("active");
                            }
                            _draw = "";
                            $(".btn").blur();
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
                            mviewer.getMap().addInteraction(_draw);
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

        getXYFromCoordinate: function () {
            if (_processing === false) {
                if (key_gap != 0){
                    ol.Observable.unByKey(key_gap);
                    key_gap=0;
                }
                //si on souhaite renseigner manuellement la coordonnees xy
                if ($("#XYWaterFlowSimulation").val() && !$("#XYWaterFlowSimulation").val().match(/[a-z]/i)) {
                    //supprime les espaces, remplace les virgules et les points
                    inputCoordinate = $("#XYWaterFlowSimulation").val().replace(/ /g, "");
                    if (inputCoordinate.search(";") != -1) {
                        inputCoordinate = inputCoordinate.replace(",", ".").replace(";", ",");
                    }
                    if (insideProjectArea(String(inputCoordinate).split(',')[0], String(inputCoordinate).split(',')[1]) === true) {
                        // dismiss button appear
                        $("#dismiss").toggleClass("hidden");
                        // defini les parametres x,y du service
                        var dictInputs = {
                            X: String(inputCoordinate).split(',')[0],
                            Y: String(inputCoordinate).split(',')[1]
                        };
                        // construit la requete wps
                        _rqtWPS = buildPostRequest(dictInputs, _identifierXY);
                        console.log(_rqtWPS);
                        // defini des valeurs globales dans le cas d'une reexecution
                        // si le process posse en file d'attente et execute le process
                        _refreshTime = 2000;
                        _timeOut = 100000;

                        _timerCountdown = 2;
                        _display = document.querySelector('#countdown');
                        // supprimer les couches
                        deleteLayers(["Watersheds", "StationsAvailable", "StationsSelected", "TargetWatershed"]);
                        processingBarUpdate(0, "Initialisation");
                        processExecution();
                        _processing = true;
                        //clear le champ
                        $("#XYWaterFlowSimulation").val("");

                        // supprime les resultats du precedent process
                        if ($("#graphFlowSimulated").children().first()) {
                          $("#divPopup1").children().remove();
                        }
                        if ($("#graphFlowSimulated").children().first()) {
                            $("#graphFlowSimulated").children().first().remove();
                            $("#graphFlowSimulatedExtend").children().first().remove();
                            $("#divPopup2").children().first().remove();
                            $("#divPopup4").children().remove();
                        }
                        // affiche le panneau de resultat
                        if ($("#bottom-panel").hasClass("")) {
                            $("#bottom-panel").toggleClass("active");
                        }
                        $(".btn").blur();
                    } else {
                        //translate
                        if (mviewer.lang.lang == "en") {
                            Swal.fire({
                                icon: 'warning',
                                title: 'Warning',
                                text: "Please enter a coordinate in the SIMFEN project field.",
                            });

                            } else{
                                Swal.fire({
                                    icon: 'warning',
                                    title: 'Attention',
                                    text: "Veuillez indiquer une coordonnée dans la zone du projet SIMFEN.",
                                });
                              }
                    }
                } else {
                    if (mviewer.lang.lang == "en") {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Warning',
                            text: "Please enter an X,Y coordinate.",
                        });
                    } else{
                        Swal.fire({
                            icon: 'warning',
                            title: 'Attention',
                            text: "Veuillez indiquer une coordonnée X,Y.",
                        });
                    }
                }
            } else {
                if (mviewer.lang.lang == "en") {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Please wait until the end of the process before running a new one, if the process is locked refresh the page",
                    });
                }else{
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Veuillez attendre la fin du process avant d'en exécuter un nouveau, si vous êtes bloqué actualiser la page",
                    });
              }
            }
        },

        showAvailableStations: function () {
            if (_processing === false) {
                if (key_gap != 0){
                    ol.Observable.unByKey(key_gap);
                    key_gap=0;
                }
                if (_xy) {
                    // dismiss button appear
                    $("#dismiss").toggleClass("hidden");

                    var dictInputs = {
                        X: String(_xy).split(',')[0],
                        Y: String(_xy).split(',')[1],
                        Start: $("#dateStartWaterFlowSimulation").val(),
                        End: $("#dateEndWaterFlowSimulation").val(),
                        Project: $("#selectProjectInversion").val()
                    };
                    // construit la requete xml POST
                    _rqtWPS = buildPostRequest(dictInputs, _getStations);
                    console.log(_rqtWPS);
                    // execute le process
                    _refreshTime = 2000;
                    _timeOut = 100000;
                    _timerCountdown = 2;
                    _display = document.querySelector('#countdown');
                    deleteLayers(["Watersheds", "StationsAvailable", "StationsSelected"]);
                    processingBarUpdate(0, "Initialisation");
                    processExecution();
                    _processing = true;
                    // supprime les resultats du precedent process
                    if ($("#graphFlowSimulated").children().first()) {
                      $("#divPopup1").children().remove();
                    }
                    if ($("#graphFlowSimulated").children().first()) {
                        $("#graphFlowSimulated").children().first().remove();
                        $("#graphFlowSimulatedExtend").children().first().remove();
                        $("#divPopup2").children().first().remove();
                        $("#divPopup4").children().remove();
                    }
                    // affiche le panneau de resultat
                    if ($("#bottom-panel").hasClass("")) {
                        $("#bottom-panel").toggleClass("active");
                    }
                    $(".btn").blur();
                    } else {
                    // translate
                    if (mviewer.lang.lang == "en") {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Warning',
                            text: "Please click on the flag to define the outlet to simulate",
                        });
                    } else {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Attention',
                            text: "Veuillez cliquer sur le drapeau afin de définir l'exutoire à simuler",
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

        selectAvailableStations: function () {
            if (!select) {
                if (key_gap != 0){
                    ol.Observable.unByKey(key_gap);
                    key_gap=0};
              //cree collection pour la selection
                selection1 = new ol.Collection();


              //recupere chaque elements de la couche stationsavailable qui sont dans le polygone
                _map.getLayers().forEach(function (layer) {
                    if (layer.get('name') != undefined && (layer.get('name') === 'StationsAvailable')) {
                        _stationLayer = layer;
                    }
                 });

                var highlightStyle = new ol.style.Style({
                    image: new ol.style.RegularShape({
                        fill: new ol.style.Fill({
                            color: "pink"
                        }),
                    stroke: new ol.style.Stroke({
                        color: 'black',
                        width: 3
                    }),
                    points: 3,
                    radius: 15,
                    angle: 0,
                    }),
                });
                //cree la variable select
                select= new ol.interaction.Select({
                    layers:[_stationLayer],
                    features:selection1,
                    style: highlightStyle,
                    toggleCondition:ol.events.condition.singleClick
                });

                _map.addInteraction(select);
                $(".btn").blur();

            } else {
                // translate
                if (mviewer.lang.lang == "en") {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "You have already activated the tool, please click on the stations you want to select",
                    });
                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Attention',
                        text: "Vous avez déjà activé l'outil, veuillez cliquer sur les stations que vous voulez sélectionner",
                    });
                }
            }
        },

        _validationSelect:function () {

            _stationsSelectedByUser= (selection1.getArray().map(function(feature) {

                return feature.values_.name;

            }));
            if (_stationsSelectedByUser.length > 5) {
                // translate
                if (mviewer.lang.lang == "en") {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Please select 5 stations at most",
                    });
                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Veuillez sélectionner 5 stations au plus",
                    });
                }
                if (_select){
                    _select.getFeatures().clear();
                }
            } else {
                if (mviewer.lang.lang == "en") {

                    Swal.fire({icon: 'success',  title: "Selected stations :",
                        text: _stationsSelectedByUser,
                        confirmButtonColor: '#2e5367',
                        confirmButtonText: "Ok",
                    });
                } else {

                    Swal.fire({icon: 'success',  title: "Stations sélectionnées :",
                        text: _stationsSelectedByUser,
                        confirmButtonColor: '#2e5367',
                        confirmButtonText: "Ok",
                    });
                }
            }
            //vide les selections

            selection1.clear();

            //enleve l'interaction permettant de selectionner les stations
            mviewer.getMap().removeInteraction(select);
            select= "";

        },

        getMeasuredFlow: function () {

            if (_processing === false) {
                // Verifier que le graphique existe pour pouvoir ajouter des
                // courbes dedans
                if ($("#btnMeasuredFlow")) {
                    // dismiss button appear
                    $("#dismiss").toggleClass("hidden");

                    // Identifie les stations qui ont ete utilisees
                    // pour indiquer la liste de stations a employer
                    listStations = "";
                    for (var i = 0; i < _nameColor.length; i++) {
                        listStations += _nameColor[i].key + ",";
                    }
                    listStations = listStations.substring(0, listStations.length - 1);
                    // construit la requete wps
                    var dictInputs = {
                        Start: $("#dateStartWaterFlowSimulation").val(),
                        End: $("#dateEndWaterFlowSimulation").val(),
                        ListStations: listStations,
                        Project: $("#selectProjectInversion").val()
                    };
                    _rqtWPS = buildPostRequest(dictInputs, _identifierGetMeasuredFlow);
                    // defini des valeurs globales dans le cas d'une reexecution
                    // si le process posse en file d'attente et execute le process
                    _refreshTime = 2000;
                    _timeOut = 100000;

                    _timerCountdown = 8;
                    _display = document.querySelector('#countdown');
                    processingBarUpdate(0, "Initialisation");
                    processExecution();
                    _processing = true;
                    $(".btn").blur();
                } else {
                    // translate; normalement le bouton apparait après la simulation donc pas besoin de l'alerte
                    if (mviewer.lang.lang == "en") {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Warning',
                            text: "Please simulate the flow before pressing this button",
                        });
                    } else {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Attention',
                            text: "Veuillez simuler le débit avant d'appuyer sur ce bouton",
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
                    })
                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Warning',
                        text: "Veuillez attendre la fin du process avant d'en exécuter un nouveau, si vous êtes bloqué actualiser la page",
                    });
                }
            }
        },

        waterFlowSimulation: function () {

            if (_processing === false) {
                note=0
                if (key_gap != 0){
                    ol.Observable.unByKey(key_gap);
                    key_gap=0;
                }
                if(select){ //pour eviter le cas ou l'utilisateur oublie de valider sa sélection, s'en rend compte et recommence une selection
                            //si ne rajoute pas ces lignes la sélection sera impossible
                    selection1.clear();
                    //enleve l'interaction permettant de selectionner les stations
                    mviewer.getMap().removeInteraction(select);
                    select= "";
                }
                // controle les dates
                if ($("#dateStartWaterFlowSimulation").val() < $("#dateStartWaterFlowSimulation").attr("min")) {
                    // translate
                    if (mviewer.lang.lang == "en") {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Warning',
                            text: "Please, enter a date greater than " + $("#dateStartWaterFlowSimulation").attr("min"),
                        });
                    } else {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Attention',
                            text: "Veuillez indiquer une date supérieure au " + $("#dateStartWaterFlowSimulation").attr("min"),
                        });
                    }
                } else if ($("#dateEndWaterFlowSimulation").val() > $("#dateEndWaterFlowSimulation").attr("max")) {
                    // translate
                    if (mviewer.lang.lang == "en") {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Warning',
                            text: "Please, enter a date lower than " + $("#dateStartWaterFlowSimulation").attr("max"),
                        });
                    } else {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Attention',
                            text:"Veuillez indiquer une date inférieure au " + $("#dateStartWaterFlowSimulation").attr("max"),
                        });
                    }
                } else if ($("#dateStartWaterFlowSimulation").val() == $("#dateEndWaterFlowSimulation").val()) {
                    // translate
                    if (mviewer.lang.lang == "en") {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Warning',
                            text: "Please, indicate different dates",
                        });
                    } else {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Attention',
                            text: "Veuillez indiquer des dates différentes",
                        });
                    }
                } else {
                    if (_xy) {
                        if (typeof _stationsSelectedByUser === 'undefined' || _stationsSelectedByUser.length === 0) {
                            _stationsSelectedByUser = "None";
                        }
                        if (_stationsSelectedByUser.length > 5) {
                            // translate
                            if (mviewer.lang.lang == "en") {
                                Swal.fire({
                                    icon: 'warning',
                                    title: 'Warning',
                                    text: "Please select 5 stations at most",
                                });
                            } else {
                                Swal.fire({
                                    icon: 'warning',
                                    title: 'Warning',
                                    text: "Veuillez sélectionner 5 stations au plus",
                                });
                            }
                            if (_select){
                                _select.getFeatures().clear();
                            }
                        } else {
                            if (_select){
                                _select.getFeatures().clear();
                            }

                            var dictInputs = {
                                X: String(_xy).split(',')[0],
                                Y: String(_xy).split(',')[1],
                                Start: $("#dateStartWaterFlowSimulation").val(),
                                End: $("#dateEndWaterFlowSimulation").val(),
                                InBasin: $("#inBasinWaterFlowSimulation").is(":checked"),
                                ListStations: _stationsSelectedByUser.toString(),
                                Project: $("#selectProjectInversion").val()
                            };
                            // popup pour alerter sur le temps de traitement à venir
                            launchProcess = timeProcessAlert(dictInputs.Start, dictInputs.End, dictInputs.DeltaT);

                            if (launchProcess) {
                                // dismiss button appear
                                $("#dismiss").toggleClass("hidden");

                                // construit la requete xml POST
                                _rqtWPS = buildPostRequest(dictInputs, _identifier);
                                console.log(_rqtWPS);
                                // supprime les resultats du precedent process
                                if ($("#graphFlowSimulated").children().first()) {
                                  $("#divPopup1").children().remove();
                                }
                                if ($("#graphFlowSimulated").children().first()) {
                                    $("#graphFlowSimulated").children().first().remove();
                                    $("#graphFlowSimulatedExtend").children().first().remove();
                                    $("#divPopup2").children().first().remove();
                                    $("#divPopup4").children().remove();
                                }
                                // defini des valeurs globales dans le cas d'une reexecution
                                // si le process posse en file d'attente et execute le process
                                _refreshTime = 3000;
                                _timeOut = 100000;

                                //periodAvailable = (new Date($("#dateEndWaterFlowSimulation").attr("max")) - new Date($("#dateStartWaterFlowSimulation").attr("min"))) / 86400000;
                                _timerCountdown = 16;

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

                    } else {
                        // translate
                        if (mviewer.lang.lang == "en") {
                            Swal.fire({
                                icon: 'warning',
                                title: 'Warning',
                                text: "Please click on the flag to define the outlet to simulate",
                            });
                        } else {
                            Swal.fire({
                                icon: 'warning',
                                title: 'Attention',
                                text: "Veuillez cliquer sur le drapeau afin de définir l'exutoire à simuler",
                            });
                        }
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

        startIntro: function () {

            if (mviewer.lang.lang == "en") {
                var intro = introJs();
                intro.setOption('showProgress', true).setOption('doneLabel', 'Terminé').setOption('exitOnOverlayClick', false).setOptions({
                    steps: [
                        {
                            intro: "Hello to the SIMFEN tutorial."
                        },
                        {
                            element: '#datesimulation',
                            intro: "Clickg on this button opens the menu to select the start and end dates of the simulation."
                        },
                        {
                            element: "#exutoire",
                            intro:"Click on this button, then move over a watercourse to place &#171;the target outlet&#187; using the red cross where you wish to have the flow simulation."
                        },
                        {
                            element: '#calcul',
                            intro:"Click on this Button starts the treatment."
                        },
                        {
                            element: '#optionA',
                            intro: "This Button activates or deactivates the advanced mode allowing to refine the choices."
                        },
                        {
                            element: '#resultat',
                            intro: "This Button is used to show/hide the results (graph of flow data)"
                        },
                        {
                            element: '#stationDispo',
                            intro:"Advanced Mode: this button displays the stations within a 50km radius around &#171; the target outlet &#187; chosen. Additional information: influence regime (color coded), date of first available flow recording, click on the stations for more information."

                        },
                        {
                            element:'#selectStation',
                            intro:"Advanced Mode: after displaying the stations, this button allows you to manually select the source stations that will be used for the calculation. To select several stations (max : 5) click on the stations"

                        },
                        {
                            element:'#validationSelection',
                            intro:"Advanced Mode: this button is used to validate the selection of &#171; source stations &#187; selected &#171; source stations."
                        },
                        {
                            element:'#identifiantSimulation',
                            intro:"Advanced Mode: Name of the simulation, if saved"
                        },
                        {
                            element:'#XYWaterFlowSimulation',
                            intro:"Advanced Mode: it is possible to manually enter the X,Y coordinates (in Lambert 93) of &#171; the target outlet &#187; where one wishes to obtain the simulated flow rates."
                        },
                        {
                            element:'#validationCoord',
                            intro:"Advanced mode: click on the arrow to validate the coordinates"
                        },
                        {
                            element:'#selectProjectInversion',
                            intro:"Advanced mode: this menu allows you to choose the origin of the source data."
                        },

                    ]
                });

                intro.start().oncomplete(function() {
                    $('#stationDispo,#selectStation,#validationSelection').toggle();
                    $('#dateOptions,#waterFlowSimulationOptions').collapse('hide');
                    Swal.fire({
                        imageUrl: '/apps/simfen-test/data/image_test.png',
                        titleText :'Panneaux résultat',
                        width:'100%',
                        imageWidth:'100%'
                    });
                })
            } else {
                var intro = introJs();
                intro.setOption('showProgress', true).setOption('doneLabel', 'Terminé').setOption('exitOnOverlayClick', false).setOptions({
                    steps: [
                        {
                            intro: "Bienvenue dans le tutoriel de SIMFEN."
                        },
                        {
                            element: '#datesimulation',
                            intro: "Ce bouton permet d'ouvrir le menu pour sélectionner les dates de début et de fin de simulation"
                        },
                        {
                            element: "#exutoire",
                            intro:"Cliquer sur ce bouton, puis sur un cours d'eau pour placer &#171;l'exutoire cible&#187; à l'aide de la croix rouge. Si vous cliquez en dehors du réseau hydraulique, le processus va automatiquement placer &#171;l'exutoire cible&#187; cible sur le réseau le plus proche"
                        },
                        {
                            element: '#calcul',
                            intro:"Cliquer sur ce Bouton permet de lancer le traitement qui va calculer le débit à l'emplacement de &#171;l'exutoire cible&#187;"
                        },
                        {
                            element: '#optionA',
                            intro: "Ce Bouton active ou désactive le mode avancé permettant d'affiner les choix"
                        },
                        {
                            element: '#resultat',
                            intro: "Ce Bouton permet d'afficher/cacher les résultats (graphique des données de débits)"
                        },
                        {
                            element: '#stationDispo',
                            intro:"Mode Avancé : ce bouton permet d'afficher les stations dans un rayon de 50km autour de &#171; l'extutoire cible &#187; choisi. Informations complémentaires : régime d'influence (code couleur), la date de premier et dernier enregistrement de débit disponible, si vous cliquer sur une stations vous obtiendrez les périodes manquantes."
                        },
                        {
                            element:'#selectStation',
                            intro:"Mode Avancé : après avoir affiché les stations, ce bouton permet de sélectionner manuellement les &#171; stations sources &#187; qui seront utilisées pour le calcul. Pour sélectionner plusieurs stations (max : 5) cliquer sur les stations, pour annuler une sélection re-cliquer une station"
                        },
                        {
                            element:'#validationSelection',
                            intro:"Mode Avancé : ce bouton permet de valider la sélection des &#171; stations sources &#187; choisies"
                        },
                        {
                            element:'#identifiantSimulation',
                            intro:"Mode Avancé : Nom de la simulation, si elle est sauvegardée"
                        },
                        {
                            element:'#XYWaterFlowSimulation',
                            intro:"Mode Avancé : il est possible de rentrer manuellement les coordonnées X,Y (en Lambert 93) de &#171; l'exutoire cible &#187; où l'on souhaite obtenir les débits simulés"
                        },
                        {
                            element:'#validationCoord',
                            intro:"Mode avancé : cliquer sur la flèche pour valider les coordonnées"
                        },
                        {
                            element:'#selectProjectInversion',
                            intro:"Mode avancé : ce menu permet de chosir l'origine des données sources"
                        },

                    ]
                });

                intro.start().oncomplete(function() {
                    var idTab5 = document.getElementById("calcul");
                    idTab5.setAttribute("style", "color:white ;background-color: #2e5367;font-size:20px;width: 120px;height:109px;");
                    var idTab6 = document.getElementById("calcul_tag");
                    idTab6.setAttribute("style", "font-size:18px;");
                    var idTab7 = document.getElementById("calcul_icon");
                    idTab7.setAttribute("style", "font-size:64px;");

                    var idTab5 = document.getElementById("exutoire");
                    idTab5.setAttribute("style", "color:white ;background-color: #2e5367;font-size:20px;width: 120px;height:109px;");
                    var idTab6 = document.getElementById("exutoire_tag");
                    idTab6.setAttribute("style", "font-size:18px;");
                    var idTab7 = document.getElementById("exutoire_icon");
                    idTab7.setAttribute("style", "font-size:61px;");
                    $('#stationDispo,#selectStation,#validationSelection').toggle();
                    $('#dateOptions,#waterFlowSimulationOptions').collapse('hide');
                    expand=true;
                    Swal.fire({
                        imageUrl: '/apps/simfen-test/data/image_test.png',
                        titleText :'Panneaux résultat',
                        width:'100%',
                        imageWidth:'100%'
                    });
                })
            }
        }

    };
}());
