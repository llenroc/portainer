angular.module('createVolume', [])
.controller('CreateVolumeController', ['$q', '$scope', '$state', 'VolumeService', 'PluginService', 'ResourceControlService', 'Authentication', 'Notifications', 'FormValidator',
function ($q, $scope, $state, VolumeService, PluginService, ResourceControlService, Authentication, Notifications, FormValidator) {

  $scope.formValues = {
    Driver: 'local',
    DriverOptions: [],
    AccessControlData: new AccessControlFormData()
  };

  $scope.state = {
    formValidationError: ''
  };

  $scope.availableVolumeDrivers = [];

  $scope.addDriverOption = function() {
    $scope.formValues.DriverOptions.push({ name: '', value: '' });
  };

  $scope.removeDriverOption = function(index) {
    $scope.formValues.DriverOptions.splice(index, 1);
  };

  function validateForm(accessControlData, isAdmin) {
    $scope.state.formValidationError = '';
    var error = '';
    error = FormValidator.validateAccessControl(accessControlData, isAdmin);

    if (error) {
      $scope.state.formValidationError = error;
      return false;
    }
    return true;
  }

  $scope.create = function () {
    $('#createVolumeSpinner').show();

    var name = $scope.formValues.Name;
    var driver = $scope.formValues.Driver;
    var driverOptions = $scope.formValues.DriverOptions;
    var volumeConfiguration = VolumeService.createVolumeConfiguration(name, driver, driverOptions);
    var accessControlData = $scope.formValues.AccessControlData;
    var userDetails = Authentication.getUserDetails();
    var isAdmin = userDetails.role === 1 ? true : false;

    if (!validateForm(accessControlData, isAdmin)) {
      $('#createVolumeSpinner').hide();
      return;
    }

    VolumeService.createVolume(volumeConfiguration)
    .then(function success(data) {
      var volumeIdentifier = data.Id;
      var userId = userDetails.ID;
      return ResourceControlService.applyResourceControl('volume', volumeIdentifier, userId, accessControlData, []);
    })
    .then(function success(data) {
      Notifications.success('Volume successfully created');
      $state.go('volumes', {}, {reload: true});
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'An error occured during volume creation');
    })
    .finally(function final() {
      $('#createVolumeSpinner').hide();
    });
  };

  function initView() {
    $('#loadingViewSpinner').show();
    var endpointProvider = $scope.applicationState.endpoint.mode.provider;
    var apiVersion = $scope.applicationState.endpoint.apiVersion;
    if (endpointProvider !== 'DOCKER_SWARM') {
      PluginService.volumePlugins(apiVersion < 1.25)
      .then(function success(data) {
        $scope.availableVolumeDrivers = data;
      })
      .catch(function error(err) {
        Notifications.error('Failure', err, 'Unable to retrieve volume drivers');
      })
      .finally(function final() {
        $('#loadingViewSpinner').hide();
      });
    }
  }

  initView();
}]);
