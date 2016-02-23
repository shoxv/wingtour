var app = {

  data: {
    username: null,
    places: {},
    creds: {},
    listTemplate: Handlebars.compile($('#list-template').html()),
    $modal: $('.modal'),
    mapsUrl: 'http://maps.google.com/?&daddr='
  },

  initialize: function() {
      this.bindEvents();
      this.getName();
      this.initApigee();
      this.loadPlaces();
  },

  bindEvents: function() {
    $('.places-list').on('click', 'li', app.detailsModal);
    $('.add-place').on('click', app.addPlace);
    $('.rate-place').on('click', app.ratePlace);
    $('.close-modal').on('click', app.closeModal);
    $('#toggle-list-view').on('click', app.toggleListView);
    $('#add-place-view').on('click', app.addPlaceModal);
    $('#save-name').on('click', app.setName);
    document.addEventListener('deviceready', this.onDeviceReady, false);
  },

  getName: function() {
    app.data.username = localStorage.getItem('username');
    $('.page.active').removeClass('active');

    if (app.data.username == null) {
      $('.page.intro').addClass('active');
      $('footer').hide();
    } else {
      $('.page.app').addClass('active');
      $('footer').show();
    }
  },

  setName: function() {
    var username = $('#username').val();
    if(username.length < 2) {
      app.createAlert($('.intro'), 'red', 'Username must be greater than 1 character');
    } else {
      localStorage.setItem('username', username);
      app.getName();
    }
  },

  initApigee: function() {
      app.data.creds = new Apigee.Client({
        orgName:'shoxv',
        appName:'wingtour'
      });
      app.data.creds.login('ingraphs', 'Nyangraphs1');
      app.data.places = new Apigee.Collection({ 'client': app.data.creds, 'type': 'places'});
  },

  loadPlaces: function() {
    $.get('https://api.usergrid.com/shoxv/wingtour/places?limit=1000&access_token=' + app.data.creds.token, function(data){
      for (var i = 0; i < data.entities.length; i++) {
        var cur = data.entities[i],
            ratingsArr = cur.ratings;
        //add avg rating
        cur.ratingsAvg = 0;
        for (var j = 0; j < cur.ratings.length; j++) {
          cur.ratingsAvg += cur.ratings[j].rating;
        }
        cur.ratingsAvg = (cur.ratings.length <= 0) ? '-' : (cur.ratingsAvg / cur.ratings.length).toFixed(1);

        //filter rated
        for (var x = 0; x < ratingsArr.length; x++) {
          var item = ratingsArr[x];
          if ( item.username === app.data.username ) {
            cur.isRated = true;
          }
        }
      }
      app.data.placesResult = data;
      app.renderPlaces();
      if (!app.data.googleLoaded) {
        app.loadGoogleApi();
      } else {
        app.getDistance();
      }
    });
  },

  renderPlaces: function(){
    $('.places-list').html(app.data.listTemplate(app.data.placesResult));
  },

  toggleListView: function(){
    $('.places-list').toggleClass('inverse');
    $(this).toggleClass('inverse');
  },

  detailsModal: function(){
    var $placeModal = $('#place-details-modal'),
        $placeRatedModal = $('#place-rated-modal'),
        $modalBg = $('.modal-bg'),
        $el = $(this),
        ratingsArr = app.data.placesResult.entities.filter(function(i){
          return i.uuid == $el.attr('data-uuid')
        })[0].ratings;

    if ($el.parents('.places-list').hasClass('inverse')){

      $placeRatedModal.attr('data-uuid', $el.attr('data-uuid'))
      .find('.modal-header').text($el.find('.name').text()).end()
      .find('.avg-rating').text($el.find('.rating').text()).end()
      .find('.place-component').empty().html($el.find('.place-component').clone().html())
      .find('.rating').remove().end().end()
      .show();

      for (var i = 0; i < ratingsArr.length; i++) {
        $placeRatedModal.find('.individual-ratings').append('<li class="each-rating"> <span class="label">Username: </span><span class="username">' + ratingsArr[i].username + '</span> <span class="label">Rating: </span>' + ratingsArr[i].rating + '</li>');
      }
    } else {
      $placeModal
      .find('.modal-header').text($el.find('.name').text()).end()
      .find('.avg-rating').text($el.find('.rating').text()).end()
      .find('.place-component').empty().html($el.find('.place-component').clone().html()).end()
      .find('.rating').remove().end()
      .find('.get-directions').attr('href', app.data.mapsUrl + $el.find('.address').text()).end().show()
      .find('.rate-place').attr('data-uuid', $el.attr('data-uuid'));
    }

    $modalBg.css({
      'visibility': 'visible',
      'display': 'block',
      'opacity': 1
    });
  },

  getAddress: function(){
    var autocomplete,
        $addComponent = $('.add-place-component');

    function initialize() {
      // Create the autocomplete object, restricting the search
      // to geographical location types.
      autocomplete = new google.maps.places.Autocomplete(($('#autocomplete').get(0)), { types: ['establishment'] });
      // When the user selects an address from the dropdown,
      // populate the address fields in the form.
      google.maps.event.addListener(autocomplete, 'place_changed', function() {
        fillAddress();
      });
    }

    function fillAddress(){
      app.data.place = autocomplete.getPlace();
      $addComponent
        .find('.name').text(app.data.place.name).end()
        .find('.address').text(app.data.place.formatted_address).end()
        .find('.phone').text(app.data.place.formatted_phone_number).attr('href', 'tel:' + app.data.place.international_phone_number).end();
    }

    initialize();

  },

  addPlaceModal: function(){
    app.getAddress();
    $('.modal-bg').css({
      'visibility': 'visible',
      'display': 'block',
      'opacity': 1
    });
    $('#add-place-modal').show();
  },

  addPlace: function() {
    var $el = $(this),
        $input = $('#autocomplete');

    $el.addClass('disabled');
    if (typeof(app.data.place) !== 'undefined' && $input.val().length > 20) {
      var place = {
        'name': app.data.place.name,
        'address': app.data.place.formatted_address,
        'phone': app.data.place.formatted_phone_number,
        'ratings': []
      }
      app.data.places.addEntity(place, function(error, response){
        if(error) {
          app.createAlert(app.data.$modal, 'red', error.message)
        } else {
          app.createAlert(app.data.$modal, 'blue', response.entities[0].name + ' added!');
          app.loadPlaces();
        }
      });
    } else {
      app.createAlert(app.data.$modal, 'red', 'Please select a valid place from the dropdown.');
    }
    $el.removeClass('disabled');
  },

  ratePlace: function(uuid) {
    var rating = parseFloat($('#rating').val()),
        $this = $(this),
        uuid = $(this).attr('data-uuid'),
        ratingsArr = app.data.placesResult.entities.filter(function(i){
          return i.uuid == uuid
        })[0].ratings;

    $('.alert').remove();

    if (isNaN(rating) || rating > 5 || rating < 0) {
      app.createAlert(app.data.$modal, 'red', 'Please enter a value between 0-5');
      return;
    }

    for (var i = 0; i < ratingsArr.length; i++) {
      var cur = ratingsArr[i];
      if ( cur.username === app.data.username ) {
        app.createAlert(app.data.$modal, 'red', 'You already rated this place!' );
        return;
      }
    }

    ratingsArr.push({'username': app.data.username, 'rating': rating});

    var properties = {
      client: app.data.creds,
      data: {
        'type': 'places',
        'uuid': uuid,
        'ratings': ratingsArr
      }
    }

    $this.addClass('disabled');

    var entity = new Apigee.Entity(properties);
    entity.save(function(error, result){
      if(error) {
        app.createAlert(app.data.$modal, 'red', error.message);
        $this.removeClass('disabled');
      } else {
        app.createAlert(app.data.$modal, 'blue', 'Rating Added!');
        app.loadPlaces();
        $this.removeClass('disabled');
      }
    });

  },

  createAlert: function(el, color, content) {
    var alert = '<div class="alert" data-color=' + color + '><p class="alert-content">' + content + '</p><span class="alert-close">x</span></div>';
    $('.alert').remove();
    el.append(alert);
    $('.alert').on('click', function (){
      $(this).remove();
    });
  },

  getGeo: function() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        var geolocation = new google.maps.LatLng(
            position.coords.latitude, position.coords.longitude);

        app.data.location = {
          lat: position.coords.latitude,
          log: position.coords.longitude
        }
        app.getDistance();
      });
    }
  },

  getDistance: function(){
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        var geolocation = new google.maps.LatLng(
            position.coords.latitude, position.coords.longitude);

        app.data.location = {
          lat: position.coords.latitude,
          log: position.coords.longitude
        }

      var origin = (app.data.location ) ? new google.maps.LatLng(app.data.location.lat, app.data.location.log) : new google.maps.LatLng(37.423060, -122.072117),
          service = new google.maps.DistanceMatrixService(),
          distance;
      $('.places-list:not(".inverse") li:not(:hidden)').each(function(){
        var $this = $(this);
        service.getDistanceMatrix({
          origins: [origin],
          destinations: [$this.find('.address').text()],
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.IMPERIAL,
        }, function(response){
          distance = response.rows[0].elements[0].distance.text;
          $this.find('.distance').text(distance);
        });
      });
      });
    }
  },

  closeModal: function(){
    $('.modal, .modal-bg').hide();
    app.data.$modal.find('input').val('').end().find('.alert').remove();
    app.data.$modal.find('.place-component *, .add-place-component *').empty();
    app.data.$modal.find('.individual-ratings .each-rating').remove();
    app.data.place = null;
  },

  loadGoogleApi: function() {
    function loadScript(src){
      var script = document.createElement("script");
      script.type = "text/javascript";
      document.getElementsByTagName("head")[0].appendChild(script);
      script.src = src;
    }

    loadScript('https://maps.googleapis.com/maps/api/js?key=AIzaSyDtDECPICTEGvYe6joctfHchI63uPtChQM&libraries=places&callback=app.getDistance');
    app.data.googleLoaded = true;
  },
  // deviceready Event Handler
  //
  // The scope of 'this' is the event. In order to call the 'receivedEvent'
  // function, we must explicitly call 'app.receivedEvent(...);'
  onDeviceReady: function() {
    app.receivedEvent('deviceready');
  },
  // Update DOM on a Received Event
  receivedEvent: function(id) {
    var parentElement = document.getElementById(id);
    var listeningElement = parentElement.querySelector('.listening');
    var receivedElement = parentElement.querySelector('.received');
  },

};

$(function(){
  app.initialize();
});
