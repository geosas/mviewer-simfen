{
mviewer.customLayers.obstacle = {};

mviewer.customLayers.obstacle.layer = new ol.layer.Vector({
        source: new ol.source.Vector({
            url: "/apps/simfen-test/data/obstacle_bzh.geojson",
            format: new ol.format.GeoJSON()
        }),
        style: function(feature, resolution) {

            if(feature.get('CdHautChutClObstEcoul') === 8) {
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
          }else if(feature.get('CdHautChutClObstEcoul') === 7) {
               stl = [new ol.style.Style({
                   image: new ol.style.Circle({
                       fill: new ol.style.Fill({
                           color: 'yellow'
                       }),
                       stroke: new ol.style.Stroke({
                           color: "black",
                           width: 1
                       }),

                       radius: 4
                   })
               })];

           return stl;
         }else if(feature.get('CdHautChutClObstEcoul') === 6) {
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
         }else if(feature.get('CdHautChutClObstEcoul') === 5) {
                stl = [new ol.style.Style({
                    image: new ol.style.Circle({
                        fill: new ol.style.Fill({
                            color: 'green'
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
