
# Bienvenue sur l'Addon du MViewer pour le projet SIMFEN
=============

Dans le cadre de l'Appel à Manifestation d'Intérêt pour l'acquisition et le partage de connaissances dans le domaine de la gestion intégrée de l'eau, l'Agrocampus-Ouest a déposé un projet de Service Interopérable de Modélisation des Flux d'Eau et de Nutriments dans les bassins versants de Bretagne (SIMFEN). Ce projet s'effectue en partenariat avec l'IRSTEA Antony, GéoBretagne, le pôle métier "EAU" de GéoBretagne et l'Observatoire de l'Eau en Bretagne.

Ce projet emploie les travaux de thèse d'Alban de Lavenne concernant la modélisation de flux d'eau et ceux de Stéphane Ecrepont pour la modélisation de flux de nutriments (à venir). Ces modèles vont être intégrés dans un service web (OGC WPS) permettant à toute personne d'obtenir des informations en tout point du réseau hydrographique Breton, même sans compétences informatiques et hydrologiques. Les outils disponibles sur ce service web permettront aux gestionnaires des bassins versants, en particulier, de mieux connaître leur territoire.

Pour une utilisation simplifiée de ces outils, une application web a été développée sous forme d'add-on pour le [MViewer](https://github.com/geobretagne/mviewer). Cette forge github contient cet add-on exclusivement, l'ensemble des scripts du service OGC WPS (PyWPS, modélisation, etc...) se trouvent sur une autre forge.

Voici le lien permettant d'accéder à cet add-on : [Portail web SIMFEN](http://geowww.agrocampus-ouest.fr/mviewer/?config=/apps/simfen/simfen.xml)

## Navigateurs compatibles
-----------

- Firefox
- Chrome
- Microsoft Edge
- Internet Explorer

## Documentation
-----------

L'interface web dispose d'une documentation ([__simfen_help.xml__](simfen_help.xml)) accessible directement dans le navigateur. Celle-ci dispose de plusieurs onglets :
- Accueil : Première chose que l'utilisateur voit lorsqu'il arrive sur l'application web. Corresponds à une présentation succincte du portail cartographique du projet SIMFEN et le fonctionnement de l'outil principal de cette application qui est la "Simulation du débit".
- Aides : Cet onglet contient la description de chacun des services disponibles sur l'interface web (résultat(s) et fonctionnement).
- Références : Cette application web repose sur une valorisation scientifique de travaux de thèses, sur des outils ayant fait l'objet de publications scientifiques, d'outils préexistants. De plus, l'ensemble du projet SIMFEN fait l'objet d'une valorisation scientifique, en matière de développement hydro-informatique, qui est également référencée dans cet onglet.
- Crédits : Les financeurs, partenaires et collègues ayant permis et participé à l'élaboration de ce projet sont cités dans cet onglet. La documentation du MViewer est également référencée dans cet onglet.

## Outil nécessaire
-----------

Cette application web est un add-on pour le MViewer, il est donc nécessaire de télécharger cet outil pour pouvoir l'utiliser.

## Organisation d'un outil : exemple de la "Simulation d'un débit"
-----------

Dans le MViewer, chaque outil correspond à une couche. Une couche est référencée dans le fichier [__simfen.xml__](simfen.xml) par la balise "layer" (il est possible de faire un group). Une couche n'est pas nécessairement un objet spatial, comme un vecteur ou un raster, mais peut être un formulaire. Cette couche nécessite de créer un fichier JavaScript dans le répertoire "customlayers" ([__calcModel.js__](customlayers/calcModel.js)) afin de créer cet objet. Ensuite, il faut créer deux fichiers dans le répertoire "customcontrols" :
- un fichier HTML qui va contenir le formulaire du modèle ([__calcModel.html__](customcontrols/calcModel.html)).
- un fichier JavaScript qui va contenir l'ensemble des fonctions concernant la collecte et l'envoie des données vers le web service, le suivi de la modélisation, l'acquisition, l'affichage et la mise à disposition du résultat ([__calcModel.js__](customcontrols/calcModel.js)).

Cette méthode est à reproduire pour chaque nouvel outil que l'on souhaite rendre disponible au sein de cette application web. En dupliquant ces scripts, il est possible de conserver une partie des fonctions qui sont génériques pour certaines.

## Fonctions génériques pour un outil WPS :
-----------

Voici les étapes composant l'exécution d'un process disponible sur le web service à partir de l'add-ons SIMFEN du MViewer :
1. Collecte des données (formulaire, interaction avec la carte, etc...),
2. Création d'une requête POST d'après ces données,
3. Envoie de la requête au web service,
4. Suivi de l'exécution du process de manière asynchrone (il est possible de le faire de manière synchrone si les temps de calcul sont très courts),
5. Collecte des résultats,
6. Utilisation des résultats (création d'un fichier, affichage dans un graphique, etc...).

Ainsi, les fonctions employées jusqu'à l'étape 5 peuvent être réemployées sans avoir besoin de modifier les scripts de manière importante. La fonction de chaque étape va être présentée pour indiquer les parties variables et invariables, de même que le fonctionnement.

### Collecte des données :

La collecte des données s'effectue selon la manière que vous avez décidée, donc il est nécessaire d'adapter celle-ci. La variable dictInputs possède donc en key l'Identifier de l'input et en value, la valeur à assigner à celui-ci. Cette variable est donc à adapter :

```JavaScript
// avec du Jquery
var dictInputs = {
    // à partir d'une variable collectée via le script
    X: String(_xy).split(',')[0],
    Y: String(_xy).split(',')[1],
    // dans une balise HTML input via du JQuery
    Start: $("#dateStart").val(),
    End: $("#dateEnd").val(),
    // la valeur correspondant à la case cochée
    DeltaT: $("input[name='deltaT']:checked").val(),
    // si une case est cochée
    InBasin: $("#inBasin").is(":checked"),
    ListStations: listStations
};

// sans JQuery
var checkBox = document.getElementsByName("deltaT");
    for(var i=0; checkBox[i]; ++i){
        if(checkBox[i].checked){
            checkedValue = checkBox[i].value;
            break;
        } 
    }
var dictInputs = {
    // à partir d'une variable collectée via le script
    X: String(_xy).split(',')[0],
    Y: String(_xy).split(',')[1],
    // dans une balise HTML input via du Javascript
    Start: document.getElementById("dateStart").value,
    End: document.getElementById("dateEnd").value,
    // la valeur correspondant à la case cochée
    DeltaT: checkedValue,
    // si une case est cochée
    InBasin: document.getElementById("inBasin").checked,
    ListStations: listStations
};
```
Il est nécessaire de conserver la forme de cette variable (dictionnaire) pour la fonction permettant de générer la requête POST.

### Création de la requête POST :

La requête envoyée au WPS est en POST, cela permet d'effectuer des requêtes plus complexes, dans le sens où il est possible d'intégrer des accents et espaces, ce qui n'est pas possible en GET. Dans l'exemple ci-dessous, la requête possède également 3 paramètres qui n'ont rien à voir avec le process exécuté :
- lineage : permets de retourner dans le document de sortie les paramètres et valeurs qui ont été renseignés,
- status : pour retourner le statut de la requête et suivre celui-ci,
- storeExecuteResponse : génère un document XML qui va être mis à jour au fur et à mesure de l'avancement du process. Ce document permet de réaliser une exécution asynchrone avec l'objectif de suivre celui-ci via son URL pour savoir quand celui-ci est terminé et que l'on peut récupérer le résultat.

Voici la fonction qui peut être employée de façon générique :

```JavaScript
var _service = "WPS";
var _version = "1.0.0";
var _request = "Execute";
var _identifier = "calcModel";
var _storeExecuteResponse = true;
var _lineage = true;
var _status = true;

// Permet d'utiliser l'équivalent de .format{0} dans js (source :stack overflow)
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
```

Une fois la requête POST générée, il ne reste plus qu'à l'envoyer sur le serveur WPS afin que celui-ci l'exécute.

### Exécution et initialisation du suivi d'une requête WPS :

L'exécution et le suivi d'une requête WPS s'effectue avec la bibliothèque XMLHttpRequest (ou XDomainRequest sur Internet Explorer). Cette bibliothèque permet également de récupérer le statut de celle-ci (mais pas du process WPS qui nécessite un développement spécifique) et d'arrêter une requête dans le cas où le navigateur ne répond plus (timeout). Pour exécuter cette requête, il peut être nécessaire de passer par un proxy si le serveur WPS n'est pas sur le même domaine que le serveur qui envoie la requête (cross-domain). Enfin, l'objectif de cette requête POST est de lancer l'exécution du process souhaité et de récupérer l'URL du document généré par le WPS pour suivre le process et obtenir le résultat de celui-ci.

```javascript
// Cree la variable xmlrequest
function getXDomainRequest() {
    var xhr = null;
    // sous Internet Explorer
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

// Permet de gérer les requêtes cross-domain
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

var _urlWPS = "http://wps.geosas.fr/simfen?";
var _updating;

// Execute la requete Post
function processCalcModel(rqtWPS) {
    _xhrPost = getXDomainRequest();
    _xhrPost.open("POST", ajaxURL(_urlWPS), true);
    // si le navigateur ne réussit pas à exécuter la requête dans un certain délai, arrête celle-ci.
    _xhrPost.timeout = 5000;
    // ajoute un événement pour savoir si la requête a bien été envoyée et exécutée
    _xhrPost.addEventListener('readystatechange', function () {
        if (_xhrPost.readyState === XMLHttpRequest.DONE && _xhrPost.status === 200) {
            // Recupere le XML de la reponse et le converti en json
            var response = $.xml2json(_xhrPost.responseXML);
            // Recupere l'url de la variable statusLocation correspondant à l'adresse de ce document
            var statusLocationURL = response.statusLocation;
            // Lancement du suivi du process en regardant toutes les 30s l'évolution de ce document.
            // La fonction updateProcess contient une partie générique correspondant à la requête XMLHttpRequests
            // pour se connecter à ce document et une partie spécifique correspondant à la gestion du résultat et
            // à l'identification du résultat. Cette fonction nécessite à minima l'url du document.
            _updating = setInterval(function () {
                updateProcess(statusLocationURL);
            }, 30000);
        }
    });
    _xhrPost.send(rqtWPS);
}
```

Si vous ne souhaitez pas employer la bibliothèque JQuery (nécessaire pour transformer le XML en Json), il faut alors sélectionner les Tags du XML et utiliser les getAttribute, childNodes, children, nodeName, etc... pour naviguer dans le document et récupérer les informations. Cependant, Microsoft EDGE ne parvient pas à identifier les Tags se situant avant les ":", faisant que "wps:Status" sera lu comme étant "Status", rendant incompatible le script avec les navigateurs qui ont besoin du préfixe "wps:". Voici quelques exemples :

```javascript
var response = _xhrPost.responseXML;
var statusLocationURL = response.getElementsByTagName('wps:ExecuteResponse')[0].getAttribute("statusLocation");
var status = response.getElementsByTagName('wps:Status')[0].childNodes[1].nodeName;
```

### Suivi d'un process WPS et traitement du résultat :

Cette dernière fonction est générique dans le suivi et spécifique dans le traitement du résultat. Seule la partie générique va être présentée.

```javascript
function updateProcess(url) {
    _xhrGet = getXDomainRequest();
    _xhrGet.open("GET", ajaxURL(url), true);
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
            // Converti le XML en JSON pour pouvoir interagir avec les tags
            // depuis n'importe quel navigateur (EDGE ne comprend pas les tags wps: et autres)
            // tres important de le faire et ça evite de faire des getElements...)
            var response = $.xml2json(_xhrGet.responseXML);
            console.log("La requete a pris : " + request_time);
            if (!(response.Status.ProcessAccepted) && !(response.Status.ProcessStarted)) {
                // arrete l'ecoute du statut puisque le process est termine
                clearInterval(_updating);
                // si le processus terminé est un succès, récupère et traite le résultat
                if (response.Status.ProcessSucceeded) {
                    // DÉVELOPPEMENT SPÉCIFIQUE
                }
            }
        }
    });
    _xhrGet.send();
}
```

Cette fonction est appelée autant de fois que nécessaire jusqu'à obtenir le résultat (ou une erreur). Une fois le process terminé, la variable visant à suivre l'évolution du process est arrêtée (clearInterval). Ce fonctionnement est rendu possible grâce au paramètre "storeExecuteResponse" du WPS rendant possible un développement asynchrone.

Ainsi, la généricité de cet add-ons se situe dans :
- la création de la requête POST,
- l'envoi de la requête,
- le suivi du process.

Évidemment, ces fonctions peuvent être adaptées pour rajouter des étapes intermédiaires (cf. les scripts présents dans customcontrols).

## Remarques :

Voici quelques remarques pour développer votre propre add-ons :
- Évitez de commencer des lignes de code avec des [] car Internet Explorer ne sait pas gérer cela :
```JavaScript
// ne fonctionne pas sous Internet Explorer
var dictInputs = {
    [_datainputs.split("/")[0]]: [coord.split(',')[0]],
    [_datainputs.split("/")[1]]: [coord.split(',')[1]]
};
// fonctionne sous Internet Explorer
var dictInputs = {
    X: String(_xy).split(',')[0],
    Y: String(_xy).split(',')[1]
};
```

## Conclusion :

L'utilisation du MViewer pour développer des outils connectés à un service WPS est parfaite.

__TODO :__

Ajout d'outils et fonctions spécifiques au projet SIMFEN.

***
##### Powered by [![AGROCAMPUS-OUEST](http://geoinfo.agrocampus-ouest.fr/illustrations/logo_agrocampusouest.jpg)](http://www.agrocampus-ouest.fr)
***
[![Creative Commons License](https://licensebuttons.net/l/by-sa/3.0/88x31.png)](https://creativecommons.org/licenses/by-sa/4.0/)

[//]: # (These are referenced links used in the body of this note and get stripped out when the markdown processor does its job. There is no need to format nicely because it shouldn't be seen.)


   [Python 2]: <https://www.python.org/downloads/release>
   [Geoserver]: <http://geoserver.org/>
