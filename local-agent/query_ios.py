import json, sys, warnings
warnings.filterwarnings('ignore')

def out(data):
    print(json.dumps(data))
    sys.exit(0)

def fail(msg):
    print(json.dumps({"error": str(msg)}))
    sys.exit(1)

# ── Try sync API (older pymobiledevice3 style) ────────────────────────────────
def try_sync():
    from pymobiledevice3.lockdown import create_using_usbmux
    ld = create_using_usbmux()
    info = ld.all_values
    return ld, info

# ── Try async API (pymobiledevice3 v9+) ──────────────────────────────────────
async def try_async():
    from pymobiledevice3.lockdown import create_using_usbmux
    import inspect
    result = create_using_usbmux()
    if inspect.isawaitable(result):
        ld = await result
    else:
        ld = result
    try:
        info_result = ld.get_value()
        if inspect.isawaitable(info_result):
            info = await info_result
        else:
            info = info_result
    except Exception:
        info = ld.all_values
    return ld, info

def build_result(info):
    return {
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
    }

# ── Try sync first ────────────────────────────────────────────────────────────
try:
    ld, info = try_sync()
    out(build_result(info))
except Exception as sync_err:
    pass

# ── Try async ─────────────────────────────────────────────────────────────────
try:
    import asyncio
    async def run():
        ld, info = await try_async()
        return build_result(info)
    result = asyncio.run(run())
    out(result)
except Exception as async_err:
    fail(f"sync: {sync_err} | async: {async_err}")
