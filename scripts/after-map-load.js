const layerIcon = document.querySelector('.leaflet-control-layers');
layerIcon.classList.add('control-layers-with-label');

const label = document.createElement('span');
label.className = 'control-layers-label';
label.textContent = 'Слои';

const labelClick = ({ currentTarget }) => {
  currentTarget.parentElement.classList.add('leaflet-control-layers-expanded');
};

label.addEventListener('click', labelClick);
label.addEventListener('touchstart', labelClick);

layerIcon.appendChild(label);

