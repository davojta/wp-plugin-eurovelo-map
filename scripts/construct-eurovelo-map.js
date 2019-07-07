// holds a function queue to call once leaflet.js is loaded
// called in init-leaflet-map.js

var layersState = {};

var layerNames = {
  'ru': {
    'latlon': 'LatLon',
    'osm': 'OSM Mapnik',
    'genshtab': 'Генштаб, 1км',
    'rkka50k': 'РККА, 1:50000',
    'routes': 'Маршруты',
    'poi': 'Точки интереса',
  },
  'en': {
    'latlon': 'LatLon',
    'osm': 'OSM Mapnik',
    'genshtab': 'General Staff, 1km',
    'rkka50k': 'RKKA, 1:50000',
    'routes': 'Routes',
    'poi': 'Point of interest',
  }
};

var WPEuroveloMapPlugin = {
	maps : [],
	init : function () {
		// shortcodes incrementally add to this function
	},
	add : function (fnc) {
		// add to init
		var prev_init = this.init;

		this.init = function () {
			prev_init();
			fnc();
		};
	},

	addMap : function (div, opts) {
		this.add(function() {
			var map;

			map = L.map(div,
					{
						zoomControl: opts.zoomcontrol,
						scrollWheelZoom: opts.scrollwheel,
						fullscreenControl: {
							pseudoFullscreen: false
						}

					}).setView([opts.lat, opts.lng], opts.zoom);

			var hash = new L.Hash(map);

			L.control.locate({
				flyTo: true,
				locateOptions: {
					maxZoom: 15
				}
			}).addTo(map);

			var latlon = L.tileLayer('http://tile.latlon.org/tiles/{z}/{x}/{y}.png', {
					opacity: 1,
					maxZoom: 18,
					attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
					'Tiles: <a href="https://github.com/jekhor/belroad">Belroad</a> style'
					}).addTo(map);

			var osm = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					maxZoom: 19,
					attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
					});

			var genshtab = L.tileLayer.wms("http://ms.latlon.org/ms", {
				layers: 'GS-100k-N-34,GS-100k-N-35,GS-100k-N-36',
				format: 'image/png'
			});

			var rkka50k = L.tileLayer('http://orda.of.by/.tiles/rkka/Z{z}/{y}/{x}.jpg', {
					maxZoom: 14,
					attribution: '<a href="http://orda.of.by/">orda.of.by</a>'
					});

			var routes_overlays = {};
			if (opts.routes_base_url) {
				var kmlFilesNames = {
					'ru': {
									'routes': 'EuroVelo Routes',
									'vh': 'Валожынскія гасцінцы',
								},
								'en': {
									'routes': 'EuroVelo Routes',
									'vh': 'Valožynskija hascincy',
								}
							};

				var kmlFiles = {
					'eurovelo-routes.kml': kmlFilesNames.en.routes,
					'vh.kml': kmlFilesNames.en.vh
				};

				for (var file in kmlFiles) {
					var route = WPEuroveloMapPlugin.routesLayer(opts.routes_base_url + '/' + file, opts.plugin_url, opts.routes_base_url, opts.poiIcons);
					if (opts.disabled_routes.indexOf(file) == -1)
						route.addTo(map);

					routes_overlays[kmlFiles[file]] = route;
				}
			}

			var globusGroup = L.markerClusterGroup({
				showCoverageOnHover: false,
				maxClusterRadius: 50,
				iconCreateFunction: function(cluster) {
					var childCount = cluster.getChildCount();

					var c = ' marker-cluster-';
					if (childCount < 10) {
						c += 'small';
					} else if (childCount < 100) {
						c += 'medium';
					} else {
						c += 'large';
					}

					return new L.DivIcon({ html: '<div><span>' + childCount + '</span></div>', className: 'marker-cluster' + c, iconSize: new L.Point(40, 40) });
				}
			});

			WPEuroveloMapPlugin.loadGlobus(globusGroup);

			var baseLayers = {};
            baseLayers[layerNames.en.latlon] = latlon;
            baseLayers[layerNames.en.osm] = osm;
            baseLayers[layerNames.en.genshtab] = genshtab;
            baseLayers[layerNames.en.rkka50k] = rkka50k;

			var groupedOverlays = {};
            groupedOverlays[layerNames.en.routes] = routes_overlays;
            groupedOverlays[layerNames.en.poi] = {"Globus.tut.by": globusGroup};


			var layersCtl = L.control.groupedLayers(baseLayers, groupedOverlays, null, opts.plugin_url).addTo(map);

			var overlays = WPEuroveloMapPlugin.pointsLayers(opts.routes_base_url + '/' + 'points.kml', opts.plugin_url, opts.routes_base_url, opts.poiIcons, map, layersCtl);

			var globusEnabled = true;

			map.on('overlayadd', function(obj) {
				var layerName = obj.name;
				var layers = Object.keys(layersState);
				layers.forEach(function (layer) {
					if (layersState[layer].name === layerName) {
						layersState[layer].state = true;
					}
				});
				if (obj.layer === globusGroup) {
					globusEnabled = true;
				}
			});

			map.on('overlayremove', function(obj) {
				var layerName = obj.name;
				var layers = Object.keys(layersState);
				layers.forEach(function (layer) {
					if (layersState[layer].name === layerName && map.getZoom() >= layersState[layer].minZoom) {
						layersState[layer].state = false;
					}
				});
				if (obj.layer === globusGroup) {
					globusEnabled = false;
				}
			});

			var initZoom = null;
			map.on('zoomstart', function() {
				initZoom = map.getZoom();
			});

			map.on('zoomend', function() {
				if (map.getZoom() === 14) {
					if (!map.hasLayer(globusGroup) && globusEnabled) {
						globusGroup.addTo(map);
					}
				} else if (map.hasLayer(globusGroup) && map.getZoom() > 14) {
					globusGroup.addTo(map);
				} else {
					map.removeLayer(globusGroup);
				}
				for (overlay in overlays) {
					var o = overlays[overlay];
					if (map.getZoom() >= o.minZoom && layersState[overlay].initLoad) {
						layersState[overlay].state = true;
						layersState[overlay].initLoad = false;
					}
					if (map.getZoom() >= o.minZoom && layersState[overlay].state) {
						o.layer.addTo(map);
					} else {
						map.removeLayer(o.layer);
					}
				}
			});


			WPEuroveloMapPlugin.maps.push(map);
		});
	},

	loadGlobus: function (group) {
		var items = GetGeoItems();

		var icon = L.divIcon({
			className: 'fa fa-globe fa-lg icon-globus'
		});

		for (i in items) {
			var poi = items[i];
			var marker = L.marker([poi.lt, poi.ln], {icon: icon});
			var preview_url;
			var img = '';

			if (poi.mi != '') {
				if (poi.w == 'GA')
					preview_url = 'http://orda.of.by/.ga/' + poi.ps[0] + '/' + poi.ps + '/' + poi.os + '/nf/.preview/' + poi.mi;
				else
					preview_url = 'http://globus.tut.by/_wh150/' + poi.ps + '/' + poi.mi;

				img = '<br/><img width="150px" src="' + preview_url + '"></img>';
			}

			marker.bindPopup('<a href="http://globus.tut.by/' + poi.ps + '"><h3>' + poi.p + '</h3></a>' +
					'<a href="http://globus.tut.by/' + poi.ps + '/' + poi.os + '">' + poi.o + '</a><br/>' +
					poi.d +
					img);
			group.addLayer(marker);
		}
	},

	pointsLayers: function(file, pluginUrl, baseRoutesUrl, customPois, map, ctl) {
		if (customPois)
			var poiIcons = customPois;
		else
			var poiIcons = {
				'rail.png': 'railway-station',
				'bus.png': 'railway-station',
				'hostel.png': 'table-shelter',
				'hotel.png': 'hotel',
				'beautiful.png': 'viewpoint',
				'world.png': 'info',
				'info.png': 'info',
				'text.png': 'info',
				'beach.png': 'beach',
				'tent.png': 'camping',
				'cycling.png': 'bike-repair',
				'coffee.png': 'cafe',
				'drinkingwater': 'water'
			};
		var poiGroupNames = {
			'ru': {
              'hotel': 'Отель',
              'hostel': 'Хостел',
              'farmstead': 'Агроусадьба',
              'camping': 'Кемпинг',
              'camping-paid':'Кемпинг (платный)',
              'water': 'Питьевая вода',
              'table': 'Стол',
              'table-shelter': 'Стол с навесом',
              'bike-repair': 'Велоремонт',
              'campsite': 'Место для палатки',
              'relax': 'Место отдыха',
              'bike-rental': 'Аренда велосипедов',
              'fireplace': 'Место для огня',
              'beach': 'Пляж',
              'cafe': 'Кафе, ресторан',
              'toilet': 'Туалет',
              'shop': 'Магазин',
              'info': 'Инфопункт',
              'railway-station': 'Станция ж/д',
              'viewpoint': 'Обзорная точка',
              'poi': 'Достопримечательность',
              'bus-stop': 'Автобусная остановка',
              'nature': 'Природный объект'
            },
            'en': {
              'hotel': 'Hotel',
              'hostel': 'Hostel',
              'farmstead': 'Farmstead',
              'camping': 'Camping',
              'camping-paid':'Camping (paid)',
              'water': 'Water',
              'table': 'Table',
              'table-shelter': 'Canopy table',
              'bike-repair': 'Bike repair',
              'campsite': 'Campsite',
              'relax': 'Resting-place',
              'bike-rental': 'Bike rental',
              'fireplace': 'Fireplace',
              'beach': 'Beach',
              'cafe': 'Cafe',
              'toilet': 'Toilet',
              'shop': 'Shop',
              'info': 'Info',
              'railway-station': 'Railway station',
              'viewpoint': 'Viewpoint',
              'poi': 'Point of interest',
              'bus-stop': 'Bus stop',
              'nature': 'Nature'
            }
		};

		var minZooms = {
			'hotel': 10,
			'hostel': 10,
			'farmstead': 10,
			'camping': 11,
			'camping-paid': 11,
			'water': 11,
			'table': 11,
			'table-shelter': 11,
			'bike-repair': 11,
			'campsite': 11,
			'relax': 11,
			'bike-rental': 11,
			'fireplace': 11,
			'beach': 11,
			'cafe': 11,
			'toilet': 11,
			'shop': 11,
			'info': 11,
			'railway-station': 10,
			'viewpoint': 11,
			'poi': 10,
			'bus-stop': 10,
			'nature': 10
		};

		var overlays = {};

		var pointGroups = {};
		var clusteredPoints = L.markerClusterGroup({
				showCoverageOnHover: false,
				zoomToBoundsOnClick: false,
				maxClusterRadius: 24,
				iconCreateFunction: function(cluster) {
					var childs = cluster.getAllChildMarkers();
					var iconHtml = '<div>';
					var sizeX = 0;
					var sizeY = 0;
					var icons = [];

					for (marker in childs) {
						var icon = childs[marker].options.icon;

						if (icons.indexOf(icon.options.iconUrl) != -1)
							continue;

						icons.push(icon.options.iconUrl);

						iconHtml += '<img src="' + icon.options.iconUrl + '"/>';
						sizeX += icon.options.iconSize[0];
						if (sizeY < icon.options.iconSize[1])
							sizeY = icon.options.iconSize[1];
					}

					iconHtml += '</div>';

					return new L.DivIcon({ html: iconHtml, iconSize: new L.Point(sizeX, sizeY), className: 'poi-group' });
				}
		});

		clusteredPoints.on('clusterclick', function (e) {
			e.layer.spiderfy();
		});

		function pointsEachFeature(data, layer) {
			desc = '';

			layer.bindPopup(data.properties.name + data.properties.description);
		};

		function pointsPointToLayer(data, latlon) {
			var icon = null;

			if (data.geometry.type === "Point") {
				if (data.properties.iconUrl) {
					var kmlIcon = data.properties.iconUrl.split(/[\\/]/).pop();

					if (poiIcons[kmlIcon]) {
						icon = L.icon({
							iconUrl: pluginUrl + '/images/icons/' + poiIcons[kmlIcon] + '-light-24.png',
							iconRetinaUrl: pluginUrl + '/images/icons/' + poiIcons[kmlIcon] + '-light-48.png',
							iconSize: [24, 24],
						});
					}
				}
			} else {
				return null;
			}

			if (icon) {
				var layer = L.marker(latlon, {
					icon: icon
				});
			} else {
				var layer = L.marker(latlon, {
				});
			}

			var desc = '';

			if (data.properties.description)
				desc = '<br/>' + data.properties.description;

			layer.bindPopup('<b>' + data.properties.name + '</b>' + desc);

			if (kmlIcon && poiIcons[kmlIcon] && (pointGroups[poiIcons[kmlIcon]] === undefined)) {
				pointGroups[poiIcons[kmlIcon]] = L.featureGroup.subGroup(clusteredPoints, null);
			}

			if (kmlIcon && poiIcons[kmlIcon])
				pointGroups[poiIcons[kmlIcon]].addLayer(layer);

			return null;
		};

		var fakePoints = L.geoJson(null, {
			onEachFeature: pointsEachFeature,
			pointToLayer: pointsPointToLayer,
		});

		fakePoints.on('ready', function() {
			clusteredPoints.addTo(map);
			for (group in pointGroups) {
				overlays[group] = {
					layer: pointGroups[group],
					minZoom: minZooms[group]
				};

				if (map.getZoom() >= minZooms[group])
					pointGroups[group].addTo(map);

				ctl.addOverlay(pointGroups[group],  poiGroupNames.en[group], layerNames.en.poi);
			}
			for (overlay in overlays) {
				layersState[overlay] = {
					name: poiGroupNames.en[overlay],
					state: !!map.hasLayer(pointGroups[overlay]),
					minZoom: overlays[overlay].minZoom,
					layer: pointGroups[overlay],
					initLoad: true,
				};
			}
			fakePoints.off('ready');
		});

		omnivore.kml(file, null, fakePoints);

		return overlays;
	},

	routesLayer: function(file, pluginUrl, baseRoutesUrl, customPois) {

		function ev2EachFeature(data, layer) {
			desc = '';

			if (data.geometry.type === "Point") {
			} else {
				if (data.properties.description)
					var desc = '<br/>' + data.properties.description;
			}

			layer.bindPopup(data.properties.name + desc);
		};

		function evPointToLayer(data, latlon) {
			var icon = null;

			if (data.geometry.type === "Point") {
				return null;
			}

			return layer;
		};

		var routes = L.geoJson(null, {
			onEachFeature: ev2EachFeature,
			pointToLayer: evPointToLayer,
			style: function(feature) {
				var color = '#aa0000';
				var width = 3;

				if (feature.properties.stroke !== undefined)
					color = feature.properties.stroke;

				if (feature.properties['stroke-width'] !== undefined)
					width = feature.properties['stroke-width'];

				return {color: color, weight: width, opacity: 0.8};
			}
		});

		var kml = omnivore.kml(file, null, routes);

		return routes;
	}

};
