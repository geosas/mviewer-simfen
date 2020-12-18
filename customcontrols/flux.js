mviewer.customControls.flux = (function () {
    /*
     * Private
     */
    var _parametre
    var aire_ponderation
    var selection1
    var selection_station
    var vecteurStationQualite
    var _draw; // global so we can remove it later
    var _drawPolygon;
    var _stationLayer;
    var _xhrPost;
    var _xhrGet;
    var _xmlRequest;
    var _rqtWPS;
    var _urlWPS = "https://geosas.agrocampus-ouest.fr/simfen-test-wps?";
    var _service = "WPS";
    var _version = "1.0.0";
    var _request = "Execute";
    var _identifier = "nutrimentSimulation";
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
    var note=0
    var targetArea
    var note_barrage
    var key_gap
    var code
    var y
    var x
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
                alert("Error initialisation XMLHttpRequests");
            } else {
                alert("Erreur initialisation XMLHttpRequests");
            }
        }
        return xhr;
    }

    // Permet de gerer les requetes cross-domain
    function ajaxURL(url) {
        // relative path
        if (url.indexOf('https') !== 0) {
            return url;
        }
        // same domain
        else if (url.indexOf(location.protocol + '//' + location.host) === 0) {
            return url;
        } else {
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
            if (response.Status.ProcessStarted == "Impossible de DL les datas"){
                // translate
                if (mviewer.lang.lang == "en") {
                    processingBarUpdate(100, "Hub-Eau don't respond");
                    alert("Impossible to DL data at Hub-Eau");
                } else {
                    processingBarUpdate(100, "Hub-Eau ne répond pas");
                    alert("Impossible de télécharger les données sur Hub-Eau");
                }
                clearInterval(_updating);
                clearInterval(_countdown);
                $("#dismiss").toggleClass("hidden");
                $("#countdown")[0].textContent = "00:00";
                _processing = false;
            }
            else if (response.Status.ProcessStarted == "Pas de donnees pour ce parametre a cette localisation"){
                // translate
                if (mviewer.lang.lang == "en") {
                    processingBarUpdate(100, "No data here for NO3 ");
                    alert("Change station no data for NO3 here ");
                } else {
                    processingBarUpdate(100, "Pas de donnée ici pour NO3");
                    alert("Changer de station pas de données de NO3 à cette localisation");
                }
                clearInterval(_updating);
                clearInterval(_countdown);
                $("#dismiss").toggleClass("hidden");
                $("#countdown")[0].textContent = "00:00";
                _processing = false;
            }
             else {
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
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: "Une erreur c'est produite, si elle persiste veuillez nous contacter et nous communiquer les informations ci-dessous",
              footer:_uuid+'Station : '+_stationsSelectedByUser+'  Date : '+new Date().toLocaleString(),

            })

        } else {
            // translate
            if (mviewer.lang.lang == "en") {
                processingBarUpdate(0, "Error, refresh the page");
            } else {
                processingBarUpdate(0, "Erreur, actualisez la page");
            }
            clearInterval(_updating);
            clearInterval(_countdown);
            $("#countdown")[0].textContent = "00:00";
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

                                if (outputTag.Identifier === "dismiss") {
                                  // Hide kill process button
                                  $("#dismiss").toggleClass("hidden");
                                  _processing = false;

                                } else if (outputTag.Identifier === "StationsSelected") {
                                    plotStation(outputTag.Data.ComplexData.FeatureCollection.featureMember);
                                    _processing = false;

                                } else if (outputTag.Identifier === "Watersheds") {
                                    plotWatersheds(outputTag.Data.ComplexData.FeatureCollection.featureMember);
                                    _processing = false;

                                } else if (outputTag.Identifier === "SimulatedFlowAndNutriment") {
                                    plotFlowandNutriment(outputTag.Data.ComplexData);
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

    function setOutputFile(date, debit,concentration,flux){
        // Fonction pour generer le document de reponse contenant
        // la licence, les metadonnees de calcul et la simulation

        // Header of csvfile = Licence in panelDisclaimer
        var outFile = $("[i18n='panelDisclaimer']").text() + "\r\n";

        // Append calculation metadata
        listStations = "";
        for (var i = 0; i < _nameColor.length-1; i++) {
            listStations += _nameColor[i].key + ",";
        }
        listStations = listStations.substring(0, listStations.length - 1);

        var metadonneesCalcul;
        // translate
        if (mviewer.lang.lang == "en") {
            metadonneesCalcul = _parametre+" Quality_station;x;y;start;end;stations;timestep;hydrographic-network;target-catchment-area-km2" + "\r\n";
        } else {
            metadonneesCalcul = _parametre+" Station_qualité;x;y;debut;fin;stations;pas-de-temps;réseau-hydrographique;aire-bassin-versant-cible-km2" + "\r\n";
        }
        var period;
        // translate
        if (mviewer.lang.lang == "en") {
            period = "daily";
        } else {
            period = "journalier";
        }

        // translate
        var hydroNetwork;
        if (mviewer.lang.lang == "en") {
            hydroNetwork = "Réseau hydrographique étendu";//"modeled hydrographic network thresholded at 25 ha (DEM 50m)";
        } else {
            hydroNetwork = "Réseau hydrographique étendu";//"réseau hydrographique modélisé seuillé à 25ha (MNT 50m)";
        }
        metadonneesCalcul += String.format("{0};{1};{2};{3};{4};{5};{6};{7};{8}" ,
            code,
            x,
            y,
            date[0],
            date[date.length-1],
            listStations,
            period,
            hydroNetwork,
            aire_ponderation + "\r\n");


        // Ajoute les metadonnées au fichier de sortie
        outFile += metadonneesCalcul;

        // Produit la sortie des debits simules
        var outputSimulation;
        outputSimulation = "date;runoff(m3/s);concentration(mg/L);flux(kg/ha/jour)" + "\r\n";

        // construit chaque ligne du csv selon les donnees
        for (var i = 0; i < date.length; i++) {
            var line = '';
            line += date[i] + ";" + debit[i] + ";" + concentration[i] + ";" + flux[i];
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
            text = "Download simulation ";
        } else {
            text = "Télécharger la simulation ";
        }
        dlFile.appendChild(document.createTextNode(text));
        $("#divPopup1").append(dlFile);
        $("#linkDownloadFlow").append(glyphiconSave);
    }

    function plotFlowandNutriment(datas) {
        // notation station source
        if (Math.round(note)===1){
            codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p>Régime hydrologique des stations sources <span style='color:green'>Faiblement influencé</span></p></div>";
        } else if (Math.round(note)===2){
            codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p>Régime hydrologique des stations sources <span style='color:orange'>Moyennement influencé</span></p></div>";
        } else if (Math.round(note)===3){
            codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p>Régime hydrologique des stations sources <span style='color:red'>Fortement influencé</span></p></div>";
        } else {
            codeRegime="<div id='notation' style='padding-top:60px;font-size:20px'><p>Erreur dans la notation des stations sources </p></div>";
        }

        $("#bottom-panel .popup-content #toolsBoxPopup #divPopup4").append([codeRegime]);

      //plot le débit, la concentration et le flux à l'emplacement d'une station
        var datasJson = JSON.parse(datas);

        let trace1={
            name:"Débit",
            x:[],
            y:[],
            mode:"lines",
            opacity: 0.5,
            connectgaps:false,
            type: "scattergl",
            line: {
                color:"blue",
                width: 1
                }
        };
        let trace2={
            name:_parametre + " mg/l",
            x:[],
            y:[],
            mode:"markers",
            yaxis: 'y2',
            connectgaps:true,
            type: "scattergl",
            marker:{size:5},
            line: {
                color: "red",
                width: 1
                }
        };
        let trace3={
            name:"Flux "+ _parametre +"(kg/ha/jour)",
            x:[],
            y:[],
            mode:"markers",
            yaxis: 'y3',
            connectgaps:true,
            type: "scattergl",
            marker:{size:5},
            line: {
                color: "green",
                width: 1
                }
        };
        datasJson.forEach(function(val) {
            trace1.x.push(val["date_prelevement"]);
            trace1.y.push(val["debit"]);
            trace2.x.push(val["date_prelevement"]);
            trace2.y.push(val[_parametre]);
            trace3.x.push(val["date_prelevement"]);
            if (val["flux"]==null){
                trace3.y.push(null);
            } else {
                trace3.y.push(val["flux"]/aire_ponderation/100);
            }
        });

        setOutputFile(trace1.x,trace1.y,trace2.y,trace3.y)

        _layout = {
            xaxis: {
                title: 'Date',
                domain: [0, 0.85]
            },
            yaxis: {
                title: 'm3/s',
                titlefont:{color:"blue"},
                tickfont: {color: 'blue'},
                rangemode: 'tozero'
            },
            yaxis2: {
                title: _parametre + ' mg/l',
                titlefont:{color:"red"},
                tickfont: {color: 'red'},
                side: 'right',
                overlaying: 'y',
                rangemode: 'tozero'
            },
            yaxis3: {
                title:"Flux "+ _parametre +"(kg/ha/jour)",
                titlefont:{color:"green"},
                tickfont: {color: 'green'},
                side: 'right',
                overlaying: 'y',
                position: 0.95,
                rangemode: 'tozero'
            },
            showlegend: false,
            margin: {
                l: 40,
                r: 20,
                b: 40,
                t: 20
            }

        };

        // utilisation de newplot car plot et addtraces dupliquent la legende
        // sur le second graphique
        Plotly.newPlot($("#graphFlowSimulated")[0], [trace1,trace2,trace3], _layout, {
            responsive: false,
            modeBarButtonsToRemove: ["toggleSpikelines", "zoomIn2d", "zoomOut2d"],
            scrollZoom: true
        });

        // duplication des graphiques et utilisation de la classe hidden (visibility) car
        // plotly.relayout pose soucis, impossible de depasser 450px de height et impossible
        // de revenir a l'etat d'avant
        Plotly.newPlot($("#graphFlowSimulatedExtend")[0], [trace1,trace2,trace3], _layout, {
            responsive: false,
            modeBarButtonsToRemove: ["toggleSpikelines", "zoomIn2d", "zoomOut2d"],
            scrollZoom: true
        });
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
        }

        var createTextStyleWatershed = function (feature, colorWatershed) {
            if (feature.get('weight') != 0) {
                // translate
                if (mviewer.lang.lang == "en") {
                    label = feature.get('label') + "km2\nweight:" + feature.get('weight');
                } else {
                    label = feature.get('label') + "km2\npoids:" + feature.get('weight');
                }
            } else {
                label = "Bassin cible\n" + feature.get('label') + "km2" ;
            }
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
            if (wghosh==0){
                aire_ponderation=area;
            }
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
                    _nameColor.push({
                        key: nameWatershed,
                        value: _colors[j]
                    });
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
            $(".list-group-item.mv-layer-details.draggable[data-layerid='flux'] .row.layerdisplay-legend").hide();
            $(".mv-layer-options[data-layerid='flux'] .form-group-opacity").hide();




          },

        addQualityStation: function(){
        // add water quality station
            if ($("#parametre").val()=="no"){
                Swal.fire({
                    icon: 'warning',
                    title: 'Attention',
                    text: "Veuillez sélectionner un paramètre dans le menu déroulant en 1."
                })
            } else {
                $.ajax({
                    type: "GET",
                    dataType: "json",
                    url: "https://hubeau.eaufrance.fr/api/v1/qualite_rivieres/station_pc",
                    data:'code_region=53&size=2500&fields=code_station,coordonnee_x,coordonnee_y',
                    beforeSend:function() {
                        // supprime les resultats du precedent process de simfen débit
                        mviewer.hideLocation();
                        deleteLayers(["Watersheds", "StationsAvailable", "StationsSelected", "TargetWatershed","stationQuali"]);
                        if ($("#graphFlowSimulated").children().first()) {
                            $("#divPopup1").children().remove()
                        }
                        if ($("#graphFlowSimulated").children().first()) {
                            $("#graphFlowSimulated").children().first().remove();
                            $("#graphFlowSimulatedExtend").children().first().remove();
                            $("#divPopup2").children().first().remove();
                            $("#divPopup4").children().remove();
                        }

                        if ($("#bottom-panel").hasClass("")) {
                            $("#bottom-panel").toggleClass("active");
                        }
                        processingBarUpdate(50, "Initialisation");
                        _display = document.querySelector('#countdown')
                        startTimer(5,_display)
                    },
                    success: function(data){
                        if (mviewer.lang.lang == "en") {
                            processingBarUpdate(100, "Finished");
                        } else {
                            processingBarUpdate(100, "Terminé");
                        }
                        clearInterval(_countdown);
                        $("#countdown")[0].textContent = "00:00";

                        stationSource = new ol.source.Vector({});

                        for (var j = 0; j < data['data'].length; j++) {

                            // cree le point en veillant a changer la projection
                            var x=data['data'][j]['coordonnee_x'];
                            var y=data['data'][j]['coordonnee_y'];
                            var reproj=ol.proj.transform([x,y], 'EPSG:2154', 'EPSG:3857');
                            var featureGeom = new ol.geom.Point(reproj);
                            // cree la feature
                            var featureThing = new ol.Feature({
                                name: data['data'][j]['code_station'],
                                geometry: featureGeom,
                                x_2154:x,
                                y_2154:y
                                //////////////////////////////////////////////////AJOUT QUALITE

                            });
                            // ajoute la feature a la source

                            stationSource.addFeature(featureThing);
                        }

                        var vecteurStationQualite = new ol.layer.Vector({
                            name:"stationQuali",
                            source: stationSource,
                            style:new ol.style.Style({
                                image: new ol.style.RegularShape({
                                    fill: new ol.style.Fill({
                                        color: "#50f015",
                                    }),
                                    stroke: new ol.style.Stroke({
                                        color: 'black',
                                        width: 1
                                    }),
                                    points: 3,
                                    radius: 7,
                                    angle: 0,
                                })

                            })
                        });

                        _map.addLayer(vecteurStationQualite);

                        selection1 = new ol.Collection();
                        selection_station = new ol.interaction.Select({
                            layers:[vecteurStationQualite],
                            features:selection1
                            });

                        _map.addInteraction(selection_station);

                        var displayFeatureInfo = function(pixel) {

                            var feature = _map.forEachFeatureAtPixel(pixel, function(feature) {
                                return feature;
                            });

                            if (feature) {
                                $.ajax({
                                    type: "GET",
                                    dataType: "json",
                                    url: "https://hubeau.eaufrance.fr/api/v1/qualite_rivieres/analyse_pc",
                                    data:'code_station='+feature.get('name')+'&libelle_parametre='+$("#parametre").val()+'&code_qualification=1&fields=date_prelevement',

                                    success: function(data){
                                        if ($("#divPopup1").children().first()){
                                            $("#divPopup1").children().remove();
                                        }
                                        if ($("#graphFlowSimulated").children().first()) {
                                            $("#graphFlowSimulated").children().first().remove();
                                            $("#graphFlowSimulatedExtend").children().first().remove();
                                            $("#divPopup2").children().first().remove();
                                            $("#divPopup4").children().remove();
                                        }
                                        if (data.data.length==0){
                                            $("#divPopup1").append([
                                                "<b style='padding-top:60px;font-size:20px' >Paramètre choisi : "+$('#parametre').val(),
                                                "<br>Station "+feature.get('name')+"</b>",
                                                "<ul>",
                                                "<span style='padding-top:60px;font-size:20px'>",
                                                "<li><i>Pas d'enregistrement</i></li></ul></span>"].join(""));
                                        }
                                        $("#divPopup1").append([
                                            "<b style='padding-top:60px;font-size:20px' >Paramètre choisi : "+$('#parametre').val(),
                                            "<br>Station "+feature.get('name')+"</b>",
                                            "<ul>",
                                            "<span style='padding-top:60px;font-size:20px'>",
                                            "<li>Premier enregistrement : "+data.data[0].date_prelevement+"</li>",
                                            "<li>Dernier enregistrement : "+data.data[data.data.length-1].date_prelevement+"</li>",
                                            "<li>Nombre d'enregistrement : "+data.data.length+"</li></ul></span>"].join(""));
                                    }
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
                })
            }
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

        nutrimentSimulation: function () {
            if (_processing === false) {

                if (selection1.getArray().length=="0"){
                    Swal.fire({
                        icon: 'warning',
                        title: 'Attention',
                        text: "Veuillez cliquer sur une station sur la carte, si elle est bien sélectionnée sa couleur passera au bleu."
                    })
                } else {
                    _parametre=$("#parametre").val()
                    //_map.removeInteraction(selection_station)
                    note=0;
                    selection1.getArray().map(function(feature) {
                        code=feature.get("name");
                        x=feature.get("x_2154");
                        y=feature.get("y_2154");
                    })
                    mviewer.showLocation('EPSG:2154',x, y);

                    if (code) {
                        if (typeof _stationsSelectedByUser === 'undefined' || _stationsSelectedByUser.length === 0) {
                            _stationsSelectedByUser = "None";
                        }
                        if (_stationsSelectedByUser.length > 5) {
                            // translate
                            if (mviewer.lang.lang == "en") {
                                alert("Please select 5 stations at most");
                            } else {
                                alert("Veuillez sélectionner 5 stations au plus");
                            }
                            if (_select){
                                _select.getFeatures().clear();
                            }
                        } else {
                            if (_select){
                                _select.getFeatures().clear();
                            }

                            var dictInputs = {
                                X: x,
                                Y: y,
                                DeltaT: '1440',
                                ListStations: _stationsSelectedByUser.toString(),
                                Project: 'archives_dreal',
                                StationQuality:code,
                                Parametre:$("#parametre").val()

                            };
                            // popup pour alerter sur le temps de traitement à venir
                            launchProcess = true;

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
                                $("#divPopup1").append([
                                    "<b style='padding-top:60px;font-size:20px' >Paramètre choisi : "+$('#parametre').val(),
                                    "<br>Station "+code+"</b>"].join(""));
                                // defini des valeurs globales dans le cas d'une reexecution
                                // si le process posse en file d'attente et execute le process
                                _refreshTime = 3000;
                                _timeOut = 100000;


                                _timerCountdown = 20;

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
                        if (mviewer.lang.lang == "en") {
                            alert("Please select a station, if the process is locked refresh the page");
                        } else {
                            alert("Veuillez sélectionner une station, si vous êtes bloqué actualiser la page");
                        }
                        _map.addInteraction(selection_station);
                        }
                }
            } else {
                // translate
                if (mviewer.lang.lang == "en") {
                    alert("Please wait until the end of the process before running a new one, if the process is locked refresh the page");
                } else {
                    alert("Veuillez attendre la fin du process avant d'en exécuter un nouveau, si vous êtes bloqué actualiser la page");
                }
            }
        },

        destroy: function () {
           // mandatory - code executed when layer panel is closed
       }


    };
}());
