Feature: State handling for running scans and reader online/offline status must be checked
  If the reader goes offline, the server state must change to Error and starting a scan must be forbidden.
  While a scan is running, no new scan can be started.

  Scenario: Attempt start while scan is running
    Given a connected OPC UA client
    And a running scan
    Then I should see that the DeviceStatus is "Scanning"
    When I call the ScanStart method with DataAvailable "false"
    Then I should see that the method returned "BadInvalidState"
    And I should see that the output argument of ScanStart is 17
    And I should see that the DeviceStatus is "Scanning"

  Scenario: Attempt stop while scan is not running
    Given a connected OPC UA client
    Then I should see that the DeviceStatus is "Idle"
    When I call the ScanStop method
    Then I should see that the method returned "BadInvalidState"
    And I should see that the DeviceStatus is "Idle"

  Scenario: The server state should change depending on reader availability
    Given a connected OPC UA client
    Then I should see that the DeviceStatus is "Idle"
    When the reader goes offline
    Then I should see that the DeviceStatus is "Error"
    When the reader comes online
    And I wait 200 ms
    Then I should see that the DeviceStatus is "Idle"

  Scenario: Attempt to start scanning while the reader is offline
    Given a connected OPC UA client
    And the reader goes offline
    Then I should see that the DeviceStatus is "Error"
    When I call the ScanStart method with DataAvailable "false"
    Then I should see that the method returned "BadInvalidState"
    And I should see that the output argument of ScanStart is 17
    When the reader comes online
    And I wait 200 ms
    Then I should see that the DeviceStatus is "Idle"
    When I call the ScanStart method with DataAvailable "false"
    Then I should see that the method returned "Good"
    And I should see that the output argument of ScanStart is 0
    And I should see that the DeviceStatus is "Scanning"

  Scenario: A running scan is stopped if the reader goes offline
    Given a connected OPC UA client
    Then I should see that the DeviceStatus is "Idle"
    When I call the ScanStart method with DataAvailable "false"
    Then I should see that the method returned "Good"
    And I should see that the DeviceStatus is "Scanning"
    When the reader goes offline
    Then I should see that the DeviceStatus is "Error"
    When the reader comes online
    And I wait 200 ms
    Then I should see that the DeviceStatus is "Idle"