Feature: The RfidReaderDeviceType instance in the OPC UA server must look as expected
  Our OPC UA server exposes an RfidReaderDeviceType instance with some identifying properties.

  Scenario: The RfidReaderDevice must exist
    Given a connected OPC UA client
    Then I should see an object named "Scanner" in the Objects folder

  Scenario Outline: The identification properties must look as expected
    Given a connected OPC UA client
    Then I should see that the property <BrowseName> is <Expected>

    Examples:
      | BrowseName             | Expected           |
      | "3:AutoIdModelVersion" | "1.01"             |
      | "3:DeviceName"         | "Scanner"          |
      | "2:Manufacturer"       | "basysKom GmbH"    |
      | "2:Model"              | "Demo RFID Reader" |
      | "2:DeviceRevision"     | "1.3"              |
      | "2:HardwareRevision"   | "1.2"              |
      | "2:SerialNumber"       | "12345678"         |
      | "2:SoftwareRevision"   | "1.15"             |