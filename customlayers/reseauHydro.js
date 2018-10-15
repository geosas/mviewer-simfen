{
mviewer.customLayers.reseauHydro = {};

mviewer.customLayers.reseauHydro.layer = new ol.layer.Image({
    source: new ol.source.ImageWMS({
        url: 'http://geoxxx.agrocampus-ouest.fr/geoserver/wms',
        params: {
            'LAYERS': 'donatien:reseau_carthage_fill_burn_25m'
        },
        serverType: 'geoserver'
    })
});
    
mviewer.customLayers.reseauHydro.handle = false;
}
