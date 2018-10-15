mviewer.customControls.plotStations = (function () {
    /*
     * Private
     */
    var _draw; // global so we can remove it later
    var _xy;
    var _xhrPost;
    var _xhrGet;
    var _xmlRequest;
    var _rqtWPS;
    var _urlWPS = "http://wps.geosas.fr/simfen-dev?";
    var _service = "WPS";
    var _version = "1.0.0";
    var _request = "Execute";
    var _identifier = "getStationsGeobretagne";
    var _identifierXY = "xyOnNetwork";
    var _datainputs = "X/Y/Start/End/Distance"
    var _storeExecuteResponse = true;
    var _lineage = true;
    var _status = true;
    var _refreshTime = 1000;
    var _refreshTimeXY = 1000;
    var _waitingQueue = false;
    var _updating;
    var _timeoutCount = 0;
    
    if (window.navigator.userAgent.indexOf("Edge") > -1) {
        // Enleve de wps: a chacun des tags
        var _processAccepted = "ProcessAccepted";
        var _processStatus = "Status";
        var _processStarted = "ProcessStarted";
        var _processFailed = "ProcessFailed";
        var _processSucceeded = "ProcessSucceeded";
        var _processOutputs = "ProcessOutputs";
        var _processExecuteResponse = "ExecuteResponse";
        var _processFeatureMember = "featureMember";
        var _processCoordinates = "coordinates";
        var _processFeatureName = "code_hydro";
    } else {
        var _processAccepted = "wps:ProcessAccepted";
        var _processStatus = "wps:Status";
        var _processStarted = "wps:ProcessStarted";
        var _processFailed = "wps:ProcessFailed";
        var _processSucceeded = "wps:ProcessSucceeded";
        var _processOutputs = "wps:ProcessOutputs";
        var _processExecuteResponse = "wps:ExecuteResponse";
        var _processFeatureMember = "gml:featureMember";
        var _processCoordinates = "gml:coordinates";
        var _processFeatureName = "ogr:code_hydro";
    }

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

        for (key in dictInputs) {
            inputXml = String.format('\
            <wps:Input>\
            <ows:Identifier>{0}</ows:Identifier>\
            <wps:Data>\
            <wps:LiteralData>{1}</wps:LiteralData>\
            </wps:Data>\
            </wps:Input>', key, dictInputs[key]);
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
    
    function processingBarUpdate(percent, message){
        // si le traitement est termine
        if (percent === 100){
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
    
    function getAndSetStatus(xmlResponse) {
        // Recupere le status de la requete wps
        var status = xmlResponse.getElementsByTagName(_processStatus)[0].childNodes[1];
        // Met a jour le tableau de resultat selon ce status
        if (status.nodeName === _processAccepted) {
            processingBarUpdate(5, "File d'attente, veuillez patienter");
            return status.nodeName;

        } else if (status.nodeName === _processStarted) {
            var percent = status.getAttribute("percentCompleted");
            processingBarUpdate(percent, status.textContent);
            return status.nodeName;

        } else if (status.nodeName === _processSucceeded) {
            processingBarUpdate(100, "Processus terminé");
            return status.nodeName;

        } else if (status.nodeName === _processFailed) {
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
            processingBarUpdate(0,"Le processus a échoué, actualisez la page")
            clearInterval(_updating);
            return 'Error';
        }
    }

    function updateProcess(updating, url, popup) {
        var start_time = new Date().getTime();
        _xhrGet = getXDomainRequest();
        _xhrGet.open("GET", ajaxURL(url), true);
        // indique un timeout de 4s pour empecher les requetes
        // de s'executer indefiniment dans le cas ou le navigateur
        // passe des requetes en cache.
        _xhrGet.timeout = 2000;
        // si trop de timeout, arrete l'actualisation
        _xhrGet.ontimeout = function (){
            _timeoutCount += 1;
            if (_timeoutCount === 4) {
                clearInterval(_updating);
                processingBarUpdate(0, "Le serveur ne répond pas, actualisez le navigateur");
                _timeoutCount = 0;
            }
        }
        _xhrGet.addEventListener('readystatechange', function () {
            if (_xhrGet.readyState === XMLHttpRequest.DONE && _xhrGet.status === 200) {
                // recupere la reponse de l'url
                var xmlResponse = _xhrGet.responseXML;
                // recupere et met a jour le status du traitement
                console.log(_xhrGet);
                if (popup) {
                    var status = getAndSetStatus(xmlResponse);
                } else {
                    var status = xmlResponse.getElementsByTagName(_processStatus)[0].childNodes[1].nodeName;
                }
                var request_time = new Date().getTime() - start_time;
                console.log("La requete a pris : " + request_time);
                console.log("Le status est : " + status);
                // les textes sont ecrits directement etant donne que la fonction retourne le nodeName
                if (status !== "wps:ProcessAccepted" && status !== "wps:ProcessStarted") {
                    // arrete l'ecoute du status puisque le process est termine
                    clearInterval(_updating);
                    if (status === "wps:ProcessSucceeded") {
                        // identifie la balise de sortie
                        var processOutputs = xmlResponse.getElementsByTagName(_processOutputs);
                        for (var i = 0; i < processOutputs[0].childNodes.length; i++) {
                            try {
                                var outputName = processOutputs[0].childNodes[i].children[0].textContent;
                                if (outputName === 'XY') {
                                    _xy = processOutputs[0].childNodes[i].children[2].children[0].textContent.split(" ");
                                    mviewer.showLocation('EPSG:2154', Number(_xy[0]), Number(_xy[1]));

                                } else if (outputName === 'Stations') {
                                    var gmlStations = processOutputs[0].childNodes[i].children[2].outerHTML;
                                    plotStation(gmlStations);
                                }

                            } catch (error) {
                                continue;
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
        xhr.timeout = 4000;
        xhr.addEventListener('readystatechange', function () {
            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                // Recupere le xml de la reponse
                var xmlResponse = xhr.responseXML;
                // Recupere l'url de la variable statusLocation
                var statusLocationURL = xmlResponse.getElementsByTagName(_processExecuteResponse)[0].getAttribute("statusLocation");
                _updating = setInterval(function () {
                    updateProcess(_updating, statusLocationURL, false);
                }, _refreshTimeXY);
            }
        });
        xhr.send(rqtWPS);
    }
    
    // Execute la requete Post
    function processPlotStations(rqtWPS) {
        _xhrPost = getXDomainRequest();
        _xhrPost.open("POST", ajaxURL(_urlWPS), true);
        _xhrPost.timeout = 4000;
        _xhrPost.addEventListener('readystatechange', function () {
            if (_xhrPost.readyState === XMLHttpRequest.DONE && _xhrPost.status === 200) {
                // Recupere le xml de la reponse
                var xmlResponse = _xhrPost.responseXML;
                // Recupere l'url de la variable statusLocation
                var statusLocationURL = xmlResponse.getElementsByTagName(_processExecuteResponse)[0].getAttribute("statusLocation");
                // Maj de la barre de progression
                processingBarUpdate(5, "Vérification de la file d'attente...");
                // Debut d'ecoute du resultat
                _updating = setInterval(function () {
                    updateProcess(_updating, statusLocationURL, true);
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

    function plotStation(gmlStations) {
        /*recupere dans le document xml les informations spatiales des stations
        pour ensuite les afficher sur la carte. Si une couche de station a deja ete
        produite, la supprime avant*/
        
        function pointStyleFunctionSelected(feature) {
            return new ol.style.Style({
                image: new ol.style.Circle({
                    fill: new ol.style.Fill({
                        color: "green"
                    }),
                    stroke: new ol.style.Stroke({
                        width: 1,
                        color: "green"
                    }),
                    radius: 7
                }),
                text: createTextStyle(feature)
            });
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

        // converti la chaine de texte en objet xml
        var gmlStationsXML = StringToXMLDom(gmlStations);
        // pour chaque entite (station)
        var features = gmlStationsXML.getElementsByTagName(_processFeatureMember);
        // initialise la source de donnees qui va contenir les entites
        var stationSource = new ol.source.Vector({});

        // cree le vecteur qui va contenir les stations
        var arrStations = new Array();
        var stationLayer = new ol.layer.Vector({
            name: "stations",
            source: stationSource,
            style: pointStyleFunctionSelected
        });
    
        // pour chaque entite
        for (var j = 0; j < features.length; j++) {
            // recupere sa coordonnees et son nom
            coord = gmlStationsXML.getElementsByTagName(_processCoordinates)[j].textContent.split(",");
            nameStation = gmlStationsXML.getElementsByTagName(_processFeatureName)[j].textContent;
            arrStations.push(nameStation);

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
            $(".mv-layer-options[data-layerid='plotStations'] .form-group-opacity").hide();
            document.getElementsByClassName("mv-header")[0].children[0].textContent = "Résultats";
            // Configure la fenetre de popup
            if (!$("#toolsBoxPopup")){
            $("#bottom-panel .popup-content").append("\
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
                    [_datainputs.split("/")[0]]: [coord.split(',')[0]],
                    [_datainputs.split("/")[1]]: [coord.split(',')[1]]
                };
                // construit la requete wps
                var rqtWPS = buildPostRequest(dictInputs, _identifierXY);
                processXYOnNetwork(rqtWPS);
                //mviewer.showLocation('EPSG:2154', _xy[0], _xy[1]);
            });
            mviewer.getMap().addInteraction(_draw);
        },

        process: function () {
            if (_xy) {
                // permet de supprimer les decimales, mais cree une chaine de texte a split
                var dictInputs = {
                                [_datainputs.split("/")[0]]: [String(_xy).split(',')[0]],
                                [_datainputs.split("/")[1]]: [String(_xy).split(',')[1]],
                                [_datainputs.split("/")[2]]: [$("#dateStart").val()],
                                [_datainputs.split("/")[3]]: [$("#dateEnd").val()],
                                [_datainputs.split("/")[4]]: [$("#distanceStations").val()]
                };
                // construit la requete xml POST
                _rqtWPS = buildPostRequest(dictInputs, _identifier);
                console.log("Voici la requête WPS envoyée : " + _rqtWPS);
                // execute le process
                processPlotStations(_rqtWPS);
            } else {
                alert("Veuillez cliquer sur le drapeau afin de définir l'exutoire à simuler");
            }
        }
    };
}());
