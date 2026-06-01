"""
iPhone info query using pymobiledevice3.
Called by the local bridge: python query_ios.py
Outputs JSON to stdout.
"""
import json, sys

def main():
    try:
        from pymobiledevice3.lockdown import create_using_usbmux
        from pymobiledevice3.services.diagnostics import DiagnosticsService
    except ImportError:
        print(json.dumps({"error": "pymobiledevice3 not installed. Run: pip install pymobiledevice3"}))
        sys.exit(1)

    try:
        ld = create_using_usbmux()
    except Exception as e:
        msg = str(e)
        if 'No device found' in msg or 'Unable to connect' in msg:
            print(json.dumps({"error": "No iPhone found. Connect via USB and tap Trust on the device."}))
        else:
            print(json.dumps({"error": f"Connection failed: {msg}"}))
        sys.exit(1)

    try:
        info = ld.all_values
    except Exception as e:
        print(json.dumps({"error": f"Failed to read device info: {str(e)}"}))
        sys.exit(1)

    # Battery via diagnostics service
    battery = {}
    try:
        with DiagnosticsService(ld) as diag:
            io = diag.ioregistry_entry('AppleSmartBattery')
            if io:
                battery = {
                    'battery_health':     io.get('CurrentCapacity'),
                    'battery_cycles':     io.get('CycleCount'),
                    'battery_max_cap':    io.get('DesignCapacity'),
                    'battery_voltage':    io.get('Voltage'),
                    'battery_temperature': round((io.get('Temperature', 0) - 2731) / 10, 1) if io.get('Temperature') else None,
                }
    except Exception:
        pass

    result = {
        'platform':           'ios',
        'manufacturer':       'Apple',
        'model':              info.get('ProductType'),
        'device_name':        info.get('DeviceName'),
        'os_version':         f"iOS {info.get('ProductVersion')}" if info.get('ProductVersion') else None,
        'serial_number':      info.get('SerialNumber'),
        'imei':               info.get('InternationalMobileEquipmentIdentity'),
        'imei2':              info.get('InternationalMobileEquipmentIdentity2'),
        'udid':               info.get('UniqueDeviceID'),
        'hardware_model':     info.get('HardwareModel'),
        'cpu_arch':           info.get('CPUArchitecture'),
        'device_color':       info.get('DeviceColor'),
        'region':             info.get('RegionInfo'),
        'phone_number':       info.get('PhoneNumber'),
        'wifi_mac':           info.get('WiFiAddress'),
        'bluetooth_mac':      info.get('BluetoothAddress'),
        'wifi_enabled':       bool(info.get('WiFiAddress')),
        'bluetooth_enabled':  bool(info.get('BluetoothAddress')),
        'storage_total':      f"{round(info.get('TotalDiskCapacity', 0) / 1e9)} GB" if info.get('TotalDiskCapacity') else None,
        'storage_available':  f"{round(info.get('TotalSystemAvailable', 0) / 1e9)} GB" if info.get('TotalSystemAvailable') else None,
        'activation_state':   info.get('ActivationState'),
        'icloud_status':      'clean' if info.get('ActivationState') == 'Activated' else 'locked' if info.get('ActivationState') == 'Unactivated' else 'unknown',
        'mdm_status':         'supervised' if info.get('IsSupervised') else 'clean',
        'frp_status':         'unknown',
        **battery,
    }

    print(json.dumps(result))

if __name__ == '__main__':
    main()
