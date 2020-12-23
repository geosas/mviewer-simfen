{
mviewer.customLayers.obstacle = {};

mviewer.customLayers.obstacle.layer = new ol.layer.Vector({
    source: new ol.source.Vector({
        url: "/apps/simfen-test/data/obstacle_bzh.geojson",
        format: new ol.format.GeoJSON()
    }),
    style: function(feature, resolution) {

        if(feature.get('cdhautchutclobstecoul') === 8) {
            stl = [new ol.style.Style({
                image: new ol.style.Circle({
                    fill: new ol.style.Fill({
                        color: 'red'
                    }),
                    stroke: new ol.style.Stroke({
                        color: "black",
                        width: 1
                    }),

                    radius: 5
                })
            })];

            return stl;
        } else if(feature.get('cdhautchutclobstecoul') === 7) {
            stl = [new ol.style.Style({
                image: new ol.style.Circle({
                    fill: new ol.style.Fill({
                        color: '#21efe6'
                    }),
                    stroke: new ol.style.Stroke({
                        color: "black",
                        width: 1
                    }),

                    radius: 4
                })
            })];

            return stl;
        } else if(feature.get('cdhautchutclobstecoul') === 6) {
            stl = [new ol.style.Style({
                image: new ol.style.Circle({
                    fill: new ol.style.Fill({
                        color: 'yellow'
                    }),
                    stroke: new ol.style.Stroke({
                        color: "black",
                        width: 1
                    }),

                    radius: 3
                })
            })];

            return stl;
        } else if(feature.get('cdhautchutclobstecoul') === 5) {
            stl = [new ol.style.Style({
                image: new ol.style.Circle({
                    fill: new ol.style.Fill({
                        color: 'orange'
                    }),
                    stroke: new ol.style.Stroke({
                        color: "black",
                        width: 1
                    }),

                    radius: 3
                })
            })];

            return stl;

        } else if(feature.get('cdhautchutclobstecoul') === 4 |feature.get('cdhautchutclobstecoul') === 3) {
            stl = [new ol.style.Style({
                image: new ol.style.Circle({
                    fill: new ol.style.Fill({
                        color: '#952c15'
                    }),
                    stroke: new ol.style.Stroke({
                        color: "black",
                        width: 1
                    }),

                    radius: 3
                })
            })];

            return stl;

        } else if(feature.get('cdhautchutclobstecoul') === 2 |feature.get('cdhautchutclobstecoul') === 1) {
            stl = [new ol.style.Style({
                image: new ol.style.Circle({
                fill: new ol.style.Fill({
                    color: '#208310'
                }),
                stroke: new ol.style.Stroke({
                    color: "black",
                    width: 1
                }),

                radius: 3
                })
            })];

            return stl;
        } else if(feature.get('cdhautchutclobstecoul') === 2 |feature.get('cdhautchutclobstecoul') === 0) {
            stl = [new ol.style.Style({
                image: new ol.style.Circle({
                fill: new ol.style.Fill({
                    color: '#FEFEFE'
                }),
                stroke: new ol.style.Stroke({
                    color: "black",
                    width: 1
                }),

                radius: 3
                })
            })];

            return stl;
        }
    }
});
mviewer.customLayers.obstacle.handle = false;
}
