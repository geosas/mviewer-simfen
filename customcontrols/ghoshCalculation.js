mviewer.customControls.ghoshCalculation = (function () {
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

    var _draw; // global so we can remove it later
    var _drawPolygon;
    var _stationLayer;
    var _xy;
    var _xhrPost;
    var _xhrGet;
    var _xmlRequest;
    var _rqtWPS;
    var _urlWPS = "http://wps.geosas.fr/simfen-dev?";
    var _service = "WPS";
    var _version = "1.0.0";
    var _request = "Execute";
    var _identifier = "ghoshCalculation";
    var _getStations = "getStationsGeobretagne";
    var _identifierXY = "xyOnNetwork";
    var _storeExecuteResponse = true;
    var _lineage = true;
    var _status = true;
    var _refreshTime;
    var _refreshTimeXY;
    var _timeOut;
    var _updating;
    var _nameColor = [];
    var _timeoutCount = 0;
    var _colors = ["red", "gold", "DarkOrange", "LightSeaGreen", "purple"];
    var _processing = false;
    var _stationsSelectedByUser;

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

    function insideProjectArea(X,Y){
        // si le point cliqué est dans la zone du projet, permet son execution
        if (X < 87000 || X > 412000 || Y < 6658714 || Y > 6902794) {
            return false
        } else {
            return true
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
        var dataInputs = Object.keys(dictInputs).map(function (itm) {
            return dictInputs[itm];
        });

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
            processingBarUpdate(0, response.Status.ProcessAccepted);
            //return response.Status.ProcessAccepted;

        } else if (response.Status.ProcessStarted) {
            var percent = response.Status.ProcessStarted.percentCompleted;
            processingBarUpdate(percent, response.Status.ProcessStarted);
            //return response.Status.ProcessAccepted;

        } else if (response.Status.ProcessSucceeded) {
            processingBarUpdate(100, "Processus terminé");
            //return response.Status.ProcessSucceeded;

        } else if (response.Status.ProcessFailed) {
            processingBarUpdate(0, response.Status.ProcessFailed);
            clearInterval(_updating);

        } else {
            processingBarUpdate(0, "Le processus a échoué, actualisez la page")
            clearInterval(_updating);
        }
    }

    function updateProcess(url) {
        try {
            var start_time = new Date().getTime();
            _xhrGet = getXDomainRequest();
            _xhrGet.open("GET", ajaxURL(url), true);
            // indique un timeout pour empecher les requetes
            // de s'executer indefiniment dans le cas ou le navigateur
            // passe des requetes en cache.
            _xhrGet.timeout = _timeOut;
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
                    getAndSetStatus(response);
                    var request_time = new Date().getTime() - start_time;
                    console.log("La requete a pris : " + request_time);
                    if (!(response.Status.ProcessAccepted) && !(response.Status.ProcessStarted)) {
                        // arrete l'ecoute du status puisque le process est termine
                        clearInterval(_updating);
                        if (response.Status.ProcessSucceeded) {
                            // le comptage n'est pas le meme s'il y a plusieurs outputs
                            var outputsTags = Object.keys(response.ProcessOutputs).map(function (itm) {
                                return response.ProcessOutputs[itm];
                            });
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
                                    _processing = false;

                                } else if (outputTag.Identifier === "StationsSelected") {
                                    plotStation(outputTag.Data.ComplexData.FeatureCollection.featureMember);
                                    _processing = false;

                                }
                            }
                        }
                    }
                }
            });
            _xhrGet.send();

        } catch (error) {
            clearInterval(_updating);
            processExecution();
            console.log("La requete a ete reexecutee car il y a eu une erreur avec la reponse du service.");
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
                // Maj de la barre de progression
                processingBarUpdate(0, "Vérification de la file d'attente...");
                // Debut d'ecoute du resultat
                _updating = setInterval(function () {
                    updateProcess(statusLocationURL);
                }, _refreshTime);
            }
        });
        _xhrPost.send(_rqtWPS);
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
            if (layer.get('name') != undefined && (layer.get('name') === 'StationsSelected')) { //|| layer.get('name') === 'stations2')) {
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
        var _stationLayer = new ol.layer.Vector({
            name: "StationsSelected",
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
        _map.addLayer(_stationLayer);
    }

    return {
        /*
         * Public
         */

        init: function () {
            // mandatory - code executed when panel is opened
            $("#legend-ghoshCalculation").hide();
            $(".mv-layer-options[data-layerid='ghoshCalculation'] .form-group-opacity").hide();


            // Fonction pour afficher la coordonnee X,Y a la volee
            var mousePositionControl = new ol.control.MousePosition({
                coordinateFormat: ol.coordinate.createStringXY(0),
                projection: 'EPSG:2154',
                className: 'custom-mouse-position',
                target: document.getElementById('mouse-position'),
                undefinedHTML: 'EPSG : 2154'
            });
            mviewer.getMap().addControl(mousePositionControl);
        },

        getXY: function () {
            if (_processing === false){
                _draw = new ol.interaction.Draw({
                    type: 'Point'
                });
                _draw.on('drawend', function (event) {
                    _xy = ol.proj.transform(event.feature.getGeometry().getCoordinates(), 'EPSG:3857', 'EPSG:2154');
                    mviewer.getMap().removeInteraction(_draw);
                    var template = '{x},{y}';
                    coord = ol.coordinate.format(_xy, template);

                    // si le point clique dans la zone n'est pas dans le projet, ne lance pas le service
                    if (insideProjectArea(String(_xy).split(',')[0],String(_xy).split(',')[1])===true) {
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
                        _timeOut = 5000;
                        processExecution();
                        _processing = true;
                    } else {
                        alert("Veuillez cliquer dans la zone du projet SIMFEN.")
                    }
                });
                mviewer.getMap().addInteraction(_draw);
            } else {
                alert("Veuillez attendre la fin du process avant d'en exécuter un nouveau.");
            }
        },

        getXYFromCoordinate: function () {
        	if (_processing === false){
	        	//si on souhaite renseigner manuellement la coordonnees xy
	            if ($("#XYghoshCalculation").val() && !$("#XYghoshCalculation").val().match(/[a-z]/i)) {
	            	//supprime les espaces, remplace les virgules et les points
	            	inputCoordinate = $("#XYghoshCalculation").val().replace(/ /g, "")
	            	if (inputCoordinate.search(";") != -1){
	            		inputCoordinate = inputCoordinate.replace(",",".").replace(";",",")
                	}
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
	                _timeOut = 5000;
	                processExecution();
	                _processing = true;
	                //clear le champ
	                $("#XYghoshCalculation").val("")
	            } else {
	            	alert("Veuillez indiquer une coordonnée X,Y.");
	            }
	        } else {
	        	alert("Veuillez attendre la fin du process avant d'en exécuter un nouveau.");
	        }
        },

        ghoshCalculation: function () {
            if (_processing === false){
                if (_xy) {
                    if (typeof _stationsSelectedByUser === 'undefined' || _stationsSelectedByUser.length === 0) {
                        _stationsSelectedByUser = "None";
                    }
                    if (_stationsSelectedByUser.length > 5) {
                        alert("Veuillez sélectionner 5 stations au plus.");
                    } else {
                        // permet de supprimer les decimales, mais cree une chaine de texte a split
                        var dictInputs = {
                            X: String(_xy).split(',')[0],
                            Y: String(_xy).split(',')[1],
                            Start: $("#dateStartghoshCalculation").val(),
                            End: $("#dateEndghoshCalculation").val(),
                            InBasin: $("#inBasinghoshCalculation").is(":checked"),
                            ListStations: _stationsSelectedByUser.toString()
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
                            while (fcBtn) {
                                divBtn.removeChild(fcBtn);
                                fcBtn = divBtn.firstChild;
                            }
                        }
                        // defini des valeurs globales dans le cas d'une reexecution
                        // si le process posse en file d'attente et execute le process
                        _refreshTime = 8000;
                        _timeOut = 10000;
                        processExecution();
                        _processing = true;

                        //supprime les stations selectionnees et la couche de stations à choisir
                        _stationsSelectedByUser = "None";
                        _map.getLayers().forEach(function(layer){
                            if (layer.get("name") === "StationsAvailable"){
                                _map.removeLayer(layer);
                            }
                        });
                        
                        // affiche le panneau de resultat
                        if ($("#bottom-panel").hasClass("")) {
                            $("#bottom-panel").toggleClass("active");
                        };
                    }

                } else {
                    alert("Veuillez cliquer sur le drapeau afin de définir l'exutoire à simuler");
                }
            } else {
                alert("Veuillez attendre la fin du process avant d'en exécuter un nouveau.");
            }
        }
    };
}());
