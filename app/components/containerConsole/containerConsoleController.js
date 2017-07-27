angular.module('containerConsole', [])
.controller('ContainerConsoleController', ['$scope', '$stateParams', 'Container', 'Image', 'EndpointProvider', 'Notifications', 'ContainerHelper', 'ContainerService', 'ExecService',
function ($scope, $stateParams, Container, Image, EndpointProvider, Notifications, ContainerHelper, ContainerService, ExecService) {
  $scope.state = {};
  $scope.state.loaded = false;
  $scope.state.connected = false;
  $scope.formValues = {};

  var socket, term;

  // Ensure the socket is closed before leaving the view
  $scope.$on('$stateChangeStart', function (event, next, current) {
    if (socket && socket !== null) {
      socket.close();
    }
  });

  Container.get({id: $stateParams.id}, function(d) {
    $scope.container = d;
    if (d.message) {
      Notifications.error('Error', d, 'Unable to retrieve container details');
      $('#loadingViewSpinner').hide();
    } else {
      Image.get({id: d.Image}, function(imgData) {
        $scope.imageOS = imgData.Os;
        $scope.formValues.command = imgData.Os === 'windows' ? 'powershell' : 'bash';
        $scope.state.loaded = true;
        $('#loadingViewSpinner').hide();
      }, function (e) {
        Notifications.error('Failure', e, 'Unable to retrieve image details');
        $('#loadingViewSpinner').hide();
      });
    }
  }, function (e) {
    Notifications.error('Failure', e, 'Unable to retrieve container details');
    $('#loadingViewSpinner').hide();
  });

  $scope.connect = function() {
    $('#loadConsoleSpinner').show();
    var termWidth = Math.round($('#terminal-container').width() / 8.2);
    var termHeight = 30;
    var command = $scope.formValues.isCustomCommand ?
                    $scope.formValues.customCommand : $scope.formValues.command;
    var execConfig = {
      id: $stateParams.id,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      User: $scope.formValues.user,
      Cmd: ContainerHelper.commandStringToArray(command)
    };

    var execId;
    ContainerService.createExec(execConfig)
    .then(function success(data) {
      execId = data.Id;
      var url = window.location.href.split('#')[0] + 'api/websocket/exec?id=' + execId + '&endpointId=' + EndpointProvider.endpointID();
      if (url.indexOf('https') > -1) {
        url = url.replace('https://', 'wss://');
      } else {
        url = url.replace('http://', 'ws://');
      }
      initTerm(url, termHeight, termWidth);
      return ExecService.resizeTTY(execId, termHeight, termWidth, 2000);
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to exec into container');
    })
    .finally(function final() {
      $('#loadConsoleSpinner').hide();
    });
  };

  $scope.disconnect = function() {
    $scope.state.connected = false;
    if (socket !== null) {
      socket.close();
    }
    if (term !== null) {
      term.destroy();
    }
  };

  function initTerm(url, height, width) {
    socket = new WebSocket(url);

    $scope.state.connected = true;
    socket.onopen = function(evt) {
      $('#loadConsoleSpinner').hide();
      term = new Terminal();

      term.on('data', function (data) {
        socket.send(data);
      });
      term.open(document.getElementById('terminal-container'), true);
      term.resize(width, height);
      term.setOption('cursorBlink', true);

      socket.onmessage = function (e) {
        term.write(e.data);
      };
      socket.onerror = function (error) {
        $scope.state.connected = false;
      };
      socket.onclose = function(evt) {
        $scope.state.connected = false;
      };
    };
  }
}]);
