mviewer.customControls.calcModel = (function () {
    /*
     * Private
     */
    var _draw; // global so we can remove it later
    var _xy;
    var _xhrPost;
    var _xhrGet;
    var _xmlRequest;
    var _rqtWPS;
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

    var _urlWPS = "http://wps.geosas.fr/simfen-dev?";
    var _service = "WPS";
    var _version = "1.0.0";
    var _request = "Execute";
    var _identifier = "calcModel";
    var _identifierXY = "xyOnNetwork";
    var _identifierGetMeasuredFlow = "getMeasuredFlow";
    var _storeExecuteResponse = true;
    var _lineage = true;
    var _status = true;
    var _refreshTime = 25000;
    var _refreshTimeXY = 1000;
    var _waitingQueue = false;
    var _updating;
    var _nameColor = [];
    var _timeoutCount = 0;
    var _colors = ["red", "green", "orange", "brown", "purple"];

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
            alert("Erreur initialisation XMLHttpRequests");
        }
        return xhr;
    }

    // Permet de gerer les requetes cross-domain
    function ajaxURL(url) {
        // relative path
        if (url.indexOf('http') !== 0) {
            return url;
        }
        // same domain
        else if (url.indexOf(location.protocol + '//' + location.host) === 0) {
            return url;
        } else {
            return '/proxy/?url=' + encodeURIComponent(url);
        }
    }

    // Cree la requete POST du process
    function buildPostRequest(dictInputs, identifier) {
        _xmlRequest = String.format('<?xml version="1.0" encoding="UTF-8"?>\
            <wps:{0} xmlns:ows="http://www.opengis.net/ows/1.1" xmlns:wps="http://www.opengis.net/wps/1.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="{1}" service="{2}" xsi:schemaLocation="http://www.opengis.net/wps/1.0.0 http://schemas.opengis.net/wps/1.0.0/wpsAll.xsd">\
            <ows:Identifier>{3}</ows:Identifier>\
            <wps:DataInputs>\
            ', _request, _version, _service, identifier);

        var dataIdentifiers = Object.keys(dictInputs);
        var dataInputs = Object.keys(dictInputs).map(function(itm){return dictInputs[itm];});

        for (var i = 0; i < dataIdentifiers.length; i++) {
            inputXml = String.format('\
            <wps:Input>\
            <ows:Identifier>{0}</ows:Identifier>\
            <wps:Data>\
            <wps:LiteralData>{1}</wps:LiteralData>\
            </wps:Data>\
            </wps:Input>', dataIdentifiers[i], dataInputs[i]);
            _xmlRequest += inputXml;
        }

        _xmlRequest += String.format('\
              </wps:DataInputs>\
               <wps:ResponseForm>\
                <wps:ResponseDocument storeExecuteResponse="{0}" lineage="{1}" status="{2}">\
                </wps:ResponseDocument>\
               </wps:ResponseForm>\
              </wps:{3}>', _storeExecuteResponse, _lineage, _status, _request);

        return _xmlRequest;
    }

    function processingBarUpdate(percent, message) {
        // si le traitement est termine
        if (percent === 100) {
            // supprime l'animation (via la valeur 0), et met le fond en bleu
            percent = 0;
            document.getElementById("processingBar").style.backgroundColor = "#007ACC";
        } else {
            document.getElementById("processingBar").style.backgroundColor = "#808080";
        }
        document.getElementById("progression").style.width = String.format("{0}%", percent);
        document.getElementById("progression").setAttribute("aria-valuenow", String.format("{0}", percent));
        document.getElementById("processing-text").innerHTML = message;
    }

    function getAndSetStatus(response) {
        // Met a jour le tableau de resultat selon ce status
        if (response.Status.ProcessAccepted) {
            processingBarUpdate(5, "File d'attente, veuillez patienter");
            //return response.Status.ProcessAccepted;

        } else if (response.Status.ProcessStarted) {
            var percent = response.Status.ProcessStarted.percentCompleted;
            processingBarUpdate(percent, response.Status.ProcessStarted);
            //return response.Status.ProcessAccepted;

        } else if (response.Status.ProcessSucceeded) {
            processingBarUpdate(100, "Processus terminé");
            //return response.Status.ProcessSucceeded;

        } else if (response.Status.ProcessFailed) {
            // relance la requete etant donne que le process n'a pas de raison de failed,
            // a part si la requete est passee dans la base sqlite et donc, 
            // elle n'a pas pu etre recuperee lorsqu'il a ete possible de l'executer

            // supprime l'ancien updating
            clearInterval(_updating);
            // execute la requete a nouveau
            //processCalcModel(_rqtWPS);
            processingBarUpdate(0, "Le processus a rencontré une erreur");
            alert("Relancez le traitement");

        } else {
            processingBarUpdate(0, "Le processus a échoué, actualisez la page")
            clearInterval(_updating);
            //return 'Error';
        }
    }

    function updateProcess(url, popup) {
        var start_time = new Date().getTime();
        _xhrGet = getXDomainRequest();
        _xhrGet.open("GET", ajaxURL(url), true);
        // indique un timeout de 4s pour empecher les requetes
        // de s'executer indefiniment dans le cas ou le navigateur
        // passe des requetes en cache.
        _xhrGet.timeout = 22000;
        // si trop de timeout, arrete l'actualisation
        _xhrGet.ontimeout = function () {
            _timeoutCount += 1;
            if (_timeoutCount === 4) {
                clearInterval(_updating);
                processingBarUpdate(0, "Le serveur ne répond pas, actualisez le navigateur");
                _timeoutCount = 0;
            }
        }
        _xhrGet.addEventListener('readystatechange', function () {
            if (_xhrGet.readyState === XMLHttpRequest.DONE && _xhrGet.status === 200) {
                // Converti le xml en JSON pour pouvoir interagir avec les tags
                // depuis n'importe quel navigateur (EDGE ne comprend pas les tags wps: et autres)
                // tres important de le faire et ça evite de faire des getElements...)
                var response = $.xml2json(_xhrGet.responseXML);
                // recupere et met a jour le status du traitement
                if (popup) {
                    getAndSetStatus(response);
                }
                var request_time = new Date().getTime() - start_time;
                console.log("La requete a pris : " + request_time);
                if (!(response.Status.ProcessAccepted) && !(response.Status.ProcessStarted)) {
                    // arrete l'ecoute du status puisque le process est termine
                    clearInterval(_updating);
                    if (response.Status.ProcessSucceeded) {
                        // le comptage n'est pas le meme s'il y a plusieurs outputs
                        var outputsTags = Object.keys(response.ProcessOutputs).map(function(itm){return response.ProcessOutputs[itm];});
                        //if (Object.values(response.ProcessOutputs)[0].length > 1) {
                        if (outputsTags[0].length > 1) {
                            var iteration = outputsTags[0].length;
                        } else {
                            var iteration = outputsTags.length;
                        }
                        
                        for (var i = 0; i < iteration; i++) {
                            if (iteration === 1) {
                                var outputTag = outputsTags[0];
                            } else {
                                var outputTag = outputsTags[0][i];
                            }
                            
                            if (outputTag.Identifier === "XY") {
                                _xy = outputTag.Data.LiteralData.split(" ");
                                mviewer.showLocation('EPSG:2154', Number(_xy[0]), Number(_xy[1]));

                            } else if (outputTag.Identifier === "WaterML") {
                                plotDatas(outputTag.Data.ComplexData.Collection.observationMember.OM_Observation.result.MeasurementTimeseries.point);
                                // ajoute le bouton pour afficher les debits mesures employes
                                $("#bottom-panel .popup-content #toolsBoxPopup #divPopup2").append("\
                                <div id='btnMeasuredFlow' style='padding-top:10px;position:absolute;'>\
                                <button class='btn btn-default' type='button'\
                                onclick='mviewer.customControls.calcModel.getMeasuredFlow();'>\
                                Cliquez pour visualiser les débits mesurés employés</button></div>");

                            } else if (outputTag.Identifier === "Stations") {
                                plotStation(outputTag.Data.ComplexData.FeatureCollection.featureMember);

                            } else if (outputTag.Identifier === "MeasuredFlow") {
                                plotMeasuredFlow(outputTag.Data.ComplexData);
                                // supprime le bouton
                                var divBtn = document.getElementById("divPopup2");
                                var fcBtn = divBtn.firstChild;
                                while(fcBtn) {
                                    divBtn.removeChild(fcBtn);
                                    fcBtn = divBtn.firstChild;
                                }
                            }
                        }
                    }
                }
            }
        });
        _xhrGet.send();
    }

    function processXYOnNetwork(rqtWPS) {
        var xhr = getXDomainRequest();
        xhr.open("POST", ajaxURL(_urlWPS), true);
        xhr.timeout = 5000;
        xhr.addEventListener('readystatechange', function () {
            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                // Recupere le xml de la reponse
                var response = $.xml2json(xhr.responseXML);
                // Recupere l'url de la variable statusLocation
                var statusLocationURL = response.statusLocation;
                _updating = setInterval(function () {
                    updateProcess(statusLocationURL, false);
                }, _refreshTimeXY);
            }
        });
        xhr.send(rqtWPS);
    }

    function processGetMeasuredStations(rqtWPS) {
        var xhr = getXDomainRequest();
        xhr.open("POST", ajaxURL(_urlWPS), true);
        xhr.timeout = 5000;
        xhr.addEventListener('readystatechange', function () {
            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                // Recupere le xml de la reponse
                var response = $.xml2json(xhr.responseXML);
                // Recupere l'url de la variable statusLocation
                var statusLocationURL = response.statusLocation;
                // Maj de la barre de progression
                processingBarUpdate(5, "Vérification de la file d'attente...");
                // Debut d'ecoute du resultat
                _updating = setInterval(function () {
                    updateProcess(statusLocationURL, true);
                }, _refreshTime);
            }
        });
        xhr.send(rqtWPS);
    }

    // Execute la requete Post
    function processCalcModel(rqtWPS) {
        _xhrPost = getXDomainRequest();
        _xhrPost.open("POST", ajaxURL(_urlWPS), true);
        _xhrPost.timeout = 5000;
        _xhrPost.addEventListener('readystatechange', function () {
            if (_xhrPost.readyState === XMLHttpRequest.DONE && _xhrPost.status === 200) {
                // Recupere le xml de la reponse
                var response = $.xml2json(_xhrPost.responseXML);
                // Recupere l'url de la variable statusLocation
                var statusLocationURL = response.statusLocation;
                if (document.getElementById("linkDownloadFlow")) {
                    document.getElementById("linkDownloadFlow").remove();
                }
                // Maj de la barre de progression
                processingBarUpdate(5, "Vérification de la file d'attente...");
                // Debut d'ecoute du resultat
                _updating = setInterval(function () {
                    updateProcess(statusLocationURL, true);
                }, _refreshTime);
            }
        });
        _xhrPost.send(rqtWPS);
    }

    function StringToXMLDom(string) {
        var xmlDoc = null;
        if (window.DOMParser) {
            var parser = new DOMParser();
            xmlDoc = parser.parseFromString(string, "text/xml");
        } else // Internet Explorer
        {
            xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = "false";
            xmlDoc.loadXML(string);
        }
        return xmlDoc;
    }

    function setDownloadFile(datasx, datasy) {
        // header of csvfile
        var str = 'date;runoff' + '\r\n';

        // construit chaque ligne du csv selon les donnees
        for (var i = 0; i < datasx.length; i++) {
            var line = '';
            line += datasx[i] + ";" + datasy[i]
            str += line + '\r\n';
        }

        // cree le csv
        var blob = new Blob([str], {
            type: "text/csv"
        });
        var url = URL.createObjectURL(blob);
        // cree l'url de telechargement et lie le fichier blob a celui-ci
        // et l'ajoute dans le tableau de bord
        var dlFile = document.createElement("a");
        dlFile.setAttribute("id", "linkDownloadFlow");
        dlFile.setAttribute("href", url);
        dlFile.setAttribute("target", "_blank");
        dlFile.setAttribute("style", "color:#337ab7;text-decoration:true;font-size:20px;");
        dlFile.setAttribute("download", "water_flow.csv");
        dlFile.setAttribute("class", "glyphicon glyphicon-save");
        dlFile.appendChild(document.createTextNode("Téléchargement des débits"));
        document.getElementById("divPopup1").appendChild(dlFile);
    }

    function plotDatas(points) {
        var xDatas = [];
        var yDatas = [];
        for (var i = 0; i < points.length; i++) {
            xDatas = xDatas.concat(points[i].MeasurementTVP.time);
            yDatas = yDatas.concat(points[i].MeasurementTVP.value);
        }

        // cree un fichier contenant les donnees au format csv
        // et permet son telechargement
        setDownloadFile(xDatas, yDatas);

        var trace = [{
            name: "Débit simulé",
            x: xDatas,
            y: yDatas,
            type: 'line'
        }];

        var layout = {
            xaxis: {
                title: 'Date',
            },
            yaxis: {
                title: 'm3/s'
            },
            showlegend: true,
            /*legend: {
                "orientation": "h"
            }*/
        };

        Plotly.newPlot(document.getElementById("graphFlowSimulated"), trace, layout);
    }

    function plotMeasuredFlow(datas) {
        var datasJson = JSON.parse(datas);
        var names = [];
        for (var i = 0; i < datasJson.length; i++) {
            names = names.concat(datasJson[i]["code_hydro"]);
        }
        // obtient les identifants uniques
        names = Array.from(new Set(names));

        for (var i = 0; i < names.length; i++) {
            var xDatas = [];
            var yDatas = [];
            for (var j = 0; j < datasJson.length; j++) {
                if (names[i] === datasJson[j].code_hydro) {
                    xDatas = xDatas.concat(datasJson[j].date);
                    yDatas = yDatas.concat(datasJson[j].debit_donnee_validee_m3);
                }
            }
            for (var j = 0; j < _nameColor.length; j++) {
                if (names[i] === _nameColor[j].key) {
                    var color = _nameColor[j].value;
                }

                var trace = [{
                    name: names[i],
                    x: xDatas,
                    y: yDatas,
                    type: 'line',
                    line: {
                        color: color
                    }
                }];
            }

            Plotly.plot(document.getElementById("graphFlowSimulated"), trace);
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
            for (var i = 0; i < _nameColor.length; i++) {
                if (feature.get('name') === _nameColor[i].key) {
                    var color = _nameColor[i].value;
                }
            }

            return new ol.style.Style({
                image: new ol.style.Circle({
                    fill: new ol.style.Fill({
                        color: color
                    }),
                    stroke: new ol.style.Stroke({
                        width: 1,
                        color: color
                    }),
                    radius: 7
                }),
                text: createTextStyle(feature)
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

        var createTextStyle = function (feature) {
            return new ol.style.Text({
                font: '12px Calibri,sans-serif',
                text: feature.get('name'),
                offsetY: 20,
                fill: new ol.style.Fill({
                    color: '#000'
                }),
                stroke: new ol.style.Stroke({
                    color: '#fff',
                    width: 5
                })
            });
        };

        // supprime la precedente couche de station si elle existe
        var layersToRemove = [];
        _map.getLayers().forEach(function (layer) {
            if (layer.get('name') != undefined && (layer.get('name') === 'stations')) { //|| layer.get('name') === 'stations2')) {
                layersToRemove.push(layer);
            }
        });
        var len = layersToRemove.length;
        for (var i = 0; i < len; i++) {
            _map.removeLayer(layersToRemove[i]);
        }

        // initialise la source de donnees qui va contenir les entites
        var stationSource = new ol.source.Vector({});

        // cree le vecteur qui va contenir les stations
        var arrStations = new Array();
        var stationLayer = new ol.layer.Vector({
            name: "stations",
            source: stationSource,
            style: pointStyleFunctionSelected
        });

        // s'il n'y a qu'une feature/station
        if (features.length == null) {
            coord = features.hydrometrie_qmj_historique.geometryProperty.Point.coordinates.split(",");
            nameStation = features.hydrometrie_qmj_historique.code_hydro;
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
                coord = features[j].hydrometrie_qmj_historique.geometryProperty.Point.coordinates.split(",");
                nameStation = features[j].hydrometrie_qmj_historique.code_hydro;
                arrStations.push(nameStation);
                _nameColor.push({
                    key: nameStation,
                    value: _colors[j]
                });
                addStation(coord, nameStation, stationSource);
            }
        }
        // ajoute la couche de point des stations a la carte
        _map.addLayer(stationLayer);
    }

    return {
        /*
         * Public
         */

        init: function () {
            // mandatory - code executed when panel is opened
            $("div").remove(".layerdisplay-legend");
            $(".mv-layer-options[data-layerid='calcModel'] .form-group-opacity").hide();
            document.getElementsByClassName("mv-header")[0].children[0].textContent = "Résultats";
            document.getElementById("searchtool").remove();
            // Configure la fenetre de resultat
            if ($("#toolsBoxPopup").length == 0) {
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
            }
            info.disable();
        },

        getXY: function () {
            _draw = new ol.interaction.Draw({
                type: 'Point'
            });
            _draw.on('drawend', function (event) {
                _xy = ol.proj.transform(event.feature.getGeometry().getCoordinates(), 'EPSG:3857', 'EPSG:2154');
                mviewer.getMap().removeInteraction(_draw);
                var template = '{x},{y}';
                coord = ol.coordinate.format(_xy, template);
                // defini les parametres x,y du service
                var dictInputs = {
                    X: String(_xy).split(',')[0],
                    Y: String(_xy).split(',')[1]
                };
                // construit la requete wps
                var rqtWPS = buildPostRequest(dictInputs, _identifierXY);
                processXYOnNetwork(rqtWPS);
                //mviewer.showLocation('EPSG:2154', _xy[0], _xy[1]);
            });
            mviewer.getMap().addInteraction(_draw);
        },

        getMeasuredFlow: function () {
            // Verifier que le graphique existe pour pouvoir ajouter des
            // courbes dedans
            if (document.getElementById("btnMeasuredFlow")) {
                // Identifie les stations qui ont ete utilisees
                // pour indiquer la liste de stations a employer
                listStations = "";
                for (var i = 0; i < _nameColor.length; i++) {
                    listStations += _nameColor[i].key + ",";
                }
                listStations = listStations.substring(0, listStations.length - 1);
                // construit la requete wps
                var dictInputs = {
                                X: String(_xy).split(',')[0],
                                Y: String(_xy).split(',')[1],
                                Start: $("#dateStart").val(),
                                End: $("#dateEnd").val(),
                                InBasin: $("#inBasin").is(":checked"),
                                ListStations: listStations
                };
                var rqtWPS = buildPostRequest(dictInputs, _identifierGetMeasuredFlow);
                processGetMeasuredStations(rqtWPS);
            } else {
                alert("Veuillez simuler le débit avant d'appuyer sur ce bouton")
            }
        },

        process: function () {
            if (_xy) {
                if ($("#listStations").val() === "") {
                    listStations = "None";
                } else {
                    listStations = $("#listStations").val();
                }

                // permet de supprimer les decimales, mais cree une chaine de texte a split
                var dictInputs = {
                                X: String(_xy).split(',')[0],
                                Y: String(_xy).split(',')[1],
                                Start: $("#dateStart").val(),
                                End: $("#dateEnd").val(),
                                DeltaT: $("input[name='deltaT']:checked").val(),
                                InBasin: $("#inBasin").is(":checked"),
                                ListStations: listStations
                };
                // construit la requete xml POST
                _rqtWPS = buildPostRequest(dictInputs, _identifier);
                console.log("Voici la requête WPS envoyée : " + _rqtWPS);
                // supprime les resultats du precedent process
                if (document.getElementById("graphFlowSimulated").firstChild) {
                    document.getElementById("graphFlowSimulated").firstChild.remove();
                    document.getElementById("divPopup1").firstChild.remove();
                    var divBtn = document.getElementById("divPopup2");
                    var fcBtn = divBtn.firstChild;
                    while(fcBtn) {
                        divBtn.removeChild(fcBtn);
                        fcBtn = divBtn.firstChild;
                    }
                }
                // execute le process
                processCalcModel(_rqtWPS);
                // affiche le panneau de resultat
                if ($("#bottom-panel").hasClass("")) {
                    $("#bottom-panel").toggleClass("active");
                };

            } else {
                alert("Veuillez cliquer sur le drapeau afin de définir l'exutoire à simuler");
            }
        }
    };
}());
