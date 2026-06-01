"""
iPhone info query using pymobiledevice3 v9+.
Called by the local bridge: py -3.12 query_ios.py
Outputs JSON to stdout.
"""
import json, sys, asyncio, warnings
warnings.filterwarnings('ignore')  # suppress async warnings to keep stdout clean

def fatal(msg):
    print(json.dumps({"error": msg}))
    sys.exit(1)

async def get_device_info():
    try:
        from pymobiledevice3.lockdown import create_using_usbmux
    except ImportError:
        fatal("pymobiledevice3 not installed. Run: py -3.12 -m pip install pymobiledevice3")
        return

    try:
        ld = await create_using_usbmux()
    except Exception as e:
        msg = str(e)
        if 'No device' in msg or 'Unable to connect' in msg or 'not found' in msg.lower():
            fatal("No iPhone found. Connect via USB and tap Trust on the device.")
        else:
            fatal(f"Connection failed: {msg}")
        return

    try:
        info = await ld.get_value()
    except Exception:
        try:
            info = ld.all_values
        except Exception as e2:
            fatal(f"Failed to read device info: {str(e2)}")
            return

    # Battery via diagnostics
    battery = {}
    try:
        from pymobiledevice3.services.diagnostics import DiagnosticsService
        async with DiagnosticsService(ld) as diag:
            io = await diag.ioregistry_entry('AppleSmartBattery')
            if io:
                temp_raw = io.get('Temperature', 0)
                battery = {
                    'battery_health':      io.get('CurrentCapacity'),
                    'battery_cycles':      io.get('CycleCount'),
                    'battery_max_cap':     io.get('DesignCapacity'),
                    'battery_voltage':     io.get('Voltage'),
                    'battery_temperature': round((temp_raw - 2731) / 10, 1) if temp_raw else None,
                }
    except Exception:
        pass

    result = {
        'platform':          'ios',
        'manufacturer':      'Apple',
        'model':             info.get('ProductType'),
        'device_name':       info.get('DeviceName'),
        'os_version':        f"iOS {info.get('ProductVersion')}" if info.get('ProductVersion') else None,
        'serial_number':     info.get('SerialNumber'),
        'imei':              info.get('InternationalMobileEquipmentIdentity'),
        'imei2':             info.get('InternationalMobileEquipmentIdentity2'),
        'udid':              info.get('UniqueDeviceID'),
        'hardware_model':    info.get('HardwareModel'),
        'cpu_arch':          info.get('CPUArchitecture'),
        'device_color':      info.get('DeviceColor'),
        'region':            info.get('RegionInfo'),
        'phone_number':      info.get('PhoneNumber'),
        'wifi_mac':          info.get('WiFiAddress'),
        'bluetooth_mac':     info.get('BluetoothAddress'),
        'wifi_enabled':      bool(info.get('WiFiAddress')),
        'bluetooth_enabled': bool(info.get('BluetoothAddress')),
        'storage_total':     f"{round(info.get('TotalDiskCapacity', 0) / 1e9)} GB" if info.get('TotalDiskCapacity') else None,
        'storage_available': f"{round(info.get('TotalSystemAvailable', 0) / 1e9)} GB" if info.get('TotalSystemAvailable') else None,
        'activation_state':  info.get('ActivationState'),
        'icloud_status':     'clean' if info.get('ActivationState') == 'Activated' else ('locked' if info.get('ActivationState') == 'Unactivated' else 'unknown'),
        'mdm_status':        'supervised' if info.get('IsSupervised') else 'clean',
        'frp_status':        'unknown',
        **battery,
    }

    print(json.dumps(result))
    await ld.aclose()

async def main():
    try:
        await get_device_info()
    except Exception as e:
        fatal(str(e))

if __name__ == '__main__':
    asyncio.run(main())
