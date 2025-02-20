Feature: Scan tags using our OPC UA server
  Our OPC UA server exposes an RfidReaderDeviceType instance with ScanStart and ScanStop methods.
  We want to check if the scanning process works as expected.

  Scenario: Single shot scan
    Given a connected OPC UA client
    And an event monitored item
    Then I should see that the DeviceStatus is "Idle"
    When I call the ScanStart method with DataAvailable "true"
    Then I should see that the method returned "Good"
    And I should see that the output argument of ScanStart is 0
    When a tag with data "Test1" is read with RSSI -42
    And a tag with data "Test2" is read with RSSI -23
    Then I should receive a RfidScanEventType event with data "Test1" and RSSI -42
    And I should see that the DeviceStatus is "Idle"
    And I should have received exactly 1 RfidScanEventType events after waiting 500 ms

  Scenario: Scan with manual stop
    Given a connected OPC UA client
    And an event monitored item
    Then I should see that the DeviceStatus is "Idle"
    When I call the ScanStart method with DataAvailable "false"
    Then I should see that the method returned "Good"
    And I should see that the output argument of ScanStart is 0
    And I should see that the DeviceStatus is "Scanning"
    When a tag with data "Test1" is read with RSSI -42
    And a tag with data "Test2" is read with RSSI -23
    Then I should receive a RfidScanEventType event with data "Test1" and RSSI -42
    And I should receive a RfidScanEventType event with data "Test2" and RSSI -23
    When I call the ScanStop method
    Then I should see that the method returned "Good"
    When a tag with data "Test3" is read with RSSI -42
    Then I should see that the DeviceStatus is "Idle"
    And I should have received exactly 2 RfidScanEventType events after waiting 500 ms