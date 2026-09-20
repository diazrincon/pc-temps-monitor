/**
 * Parser for LibreHardwareMonitor's /data.json hierarchical sensor tree.
 * Supports both Text and text casing, and handles multi-locale decimals.
 */

function parseNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  // Replace comma with dot for European locales (e.g. "54,2 °C")
  const cleaned = String(val).replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function getNodeText(node) {
  if (!node) return '';
  return node.Text || node.text || '';
}

/**
 * Recursively search the tree for sensors matching predicates
 */
function findNode(root, predicate) {
  if (!root) return null;
  if (predicate(root)) return root;
  if (Array.isArray(root.Children)) {
    for (const child of root.Children) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

function findAllNodes(root, predicate, results = []) {
  if (!root) return results;
  if (predicate(root)) results.push(root);
  if (Array.isArray(root.Children)) {
    for (const child of root.Children) {
      findAllNodes(child, predicate, results);
    }
  }
  return results;
}

/**
 * Main parser function to extract normalized telemetry metrics
 * @param {object} tree - The root object returned from LHM's /data.json
 * @returns {object} Normalized telemetry metrics
 */
function parseLhmTree(tree) {
  const result = {
    timestamp: new Date().toISOString(),
    isMock: false,
    cpu: {
      name: 'Unknown CPU',
      packageTemp: null,
      maxCoreTemp: null,
      loadTotal: null,
      power: null,
      cores: []
    },
    gpu: {
      name: 'Unknown GPU',
      coreTemp: null,
      hotspotTemp: null,
      fan1Rpm: null,
      fan2Rpm: null,
      fanPercent: null,
      coreLoad: null,
      memoryLoad: null,
      power: null
    },
    fans: {
      cpuFanRpm: null,
      caseIntakeRpm: null,
      caseExhaustRpm: null,
      motherboardTemp: null,
      allFans: []
    }
  };

  if (!tree) return result;

  // 1. Locate Hardware Nodes
  // CPU node: usually contains "Intel" or "AMD" or "CPU"
  const cpuHardwareNode = findNode(tree, (n) => {
    const text = getNodeText(n);
    return text && (text.includes('Intel') || text.includes('AMD') || text.toLowerCase().includes('ryzen') || text.includes('Core')) &&
      Array.isArray(n.Children) && n.Children.some(c => getNodeText(c) === 'Temperatures' || getNodeText(c) === 'Load');
  });

  // GPU node: usually contains "NVIDIA", "GeForce", "RTX", "Radeon"
  const gpuHardwareNode = findNode(tree, (n) => {
    const text = getNodeText(n);
    return text && (text.includes('NVIDIA') || text.includes('GeForce') || text.includes('RTX') || text.includes('Radeon') || text.includes('GPU')) &&
      Array.isArray(n.Children) && n.Children.some(c => getNodeText(c) === 'Temperatures' || getNodeText(c) === 'Fans' || getNodeText(c) === 'Load');
  });

  // Motherboard Super I/O node (e.g. Nuvoton NCT6687D or MSI board)
  let moboSensorNode = findNode(tree, (n) => {
    const text = getNodeText(n);
    return text && (text.includes('NCT') || text.includes('Nuvoton') || text.includes('ITE') || text.includes('Fintek')) &&
      Array.isArray(n.Children) && n.Children.some(c => getNodeText(c) === 'Fans' || getNodeText(c) === 'Temperatures');
  });

  if (!moboSensorNode) {
    // If not found directly, check under motherboard children
    const moboBoard = findNode(tree, (n) => {
      const text = getNodeText(n);
      return text && (text.includes('MSI') || text.includes('ASUS') || text.includes('Gigabyte') || text.includes('ASRock') || text.toLowerCase().includes('motherboard'));
    });
    if (moboBoard) {
      moboSensorNode = findNode(moboBoard, n => Array.isArray(n.Children) && n.Children.some(c => getNodeText(c) === 'Fans'));
    }
  }

  // --- CPU EXTRACTION ---
  if (cpuHardwareNode) {
    result.cpu.name = getNodeText(cpuHardwareNode);
    const tempGroup = findNode(cpuHardwareNode, n => getNodeText(n) === 'Temperatures');
    if (tempGroup && Array.isArray(tempGroup.Children)) {
      for (const sensor of tempGroup.Children) {
        const name = getNodeText(sensor).toLowerCase();
        const val = parseNumber(sensor.Value);
        if (val !== null) {
          if (name.includes('package') || name.includes('tctl') || name.includes('tdie')) {
            result.cpu.packageTemp = val;
          } else if (name.includes('max') || name.includes('core max')) {
            result.cpu.maxCoreTemp = val;
          } else if (name.includes('core #') || name.includes('cpu core')) {
            result.cpu.cores.push({ name: getNodeText(sensor), temp: val });
          }
        }
      }
      // If package temp wasn't found, fallback to core max or first core temp
      if (result.cpu.packageTemp === null) {
        if (result.cpu.maxCoreTemp !== null) {
          result.cpu.packageTemp = result.cpu.maxCoreTemp;
        } else if (result.cpu.cores.length > 0) {
          result.cpu.packageTemp = result.cpu.cores[0].temp;
        }
      }
    }

    const loadGroup = findNode(cpuHardwareNode, n => getNodeText(n) === 'Load');
    if (loadGroup && Array.isArray(loadGroup.Children)) {
      const totalLoadSensor = loadGroup.Children.find(s => getNodeText(s).toLowerCase().includes('total'));
      if (totalLoadSensor) {
        result.cpu.loadTotal = parseNumber(totalLoadSensor.Value);
      }
    }

    const powerGroup = findNode(cpuHardwareNode, n => getNodeText(n) === 'Powers');
    if (powerGroup && Array.isArray(powerGroup.Children)) {
      const packagePower = powerGroup.Children.find(s => getNodeText(s).toLowerCase().includes('package'));
      if (packagePower) {
        result.cpu.power = parseNumber(packagePower.Value);
      }
    }
  }

  // --- GPU EXTRACTION ---
  if (gpuHardwareNode) {
    result.gpu.name = getNodeText(gpuHardwareNode);

    // Temperatures
    const tempGroup = findNode(gpuHardwareNode, n => getNodeText(n) === 'Temperatures');
    if (tempGroup && Array.isArray(tempGroup.Children)) {
      for (const sensor of tempGroup.Children) {
        const name = getNodeText(sensor).toLowerCase();
        const val = parseNumber(sensor.Value);
        if (val !== null) {
          if (name.includes('hot spot') || name.includes('hotspot')) {
            result.gpu.hotspotTemp = val;
          } else if (name.includes('core') || name === 'gpu') {
            result.gpu.coreTemp = val;
          }
        }
      }
    }

    // Fans (RPM)
    const fanGroup = findNode(gpuHardwareNode, n => getNodeText(n) === 'Fans');
    if (fanGroup && Array.isArray(fanGroup.Children)) {
      for (const sensor of fanGroup.Children) {
        const name = getNodeText(sensor).toLowerCase();
        const val = parseNumber(sensor.Value);
        if (val !== null) {
          if (name.includes('1') || name.includes('gpu fan 1')) {
            result.gpu.fan1Rpm = Math.round(val);
          } else if (name.includes('2') || name.includes('gpu fan 2')) {
            result.gpu.fan2Rpm = Math.round(val);
          } else if (result.gpu.fan1Rpm === null) {
            result.gpu.fan1Rpm = Math.round(val);
          }
        }
      }
    }

    // Controls (Fan %)
    const controlGroup = findNode(gpuHardwareNode, n => getNodeText(n) === 'Controls');
    if (controlGroup && Array.isArray(controlGroup.Children)) {
      const fanControl = controlGroup.Children.find(s => getNodeText(s).toLowerCase().includes('fan'));
      if (fanControl) {
        result.gpu.fanPercent = parseNumber(fanControl.Value);
      }
    }

    // Load
    const loadGroup = findNode(gpuHardwareNode, n => getNodeText(n) === 'Load');
    if (loadGroup && Array.isArray(loadGroup.Children)) {
      for (const sensor of loadGroup.Children) {
        const name = getNodeText(sensor).toLowerCase();
        const val = parseNumber(sensor.Value);
        if (val !== null) {
          if (name.includes('core') || name === 'gpu') {
            result.gpu.coreLoad = val;
          } else if (name.includes('memory')) {
            result.gpu.memoryLoad = val;
          }
        }
      }
    }

    // Powers
    const powerGroup = findNode(gpuHardwareNode, n => getNodeText(n) === 'Powers');
    if (powerGroup && Array.isArray(powerGroup.Children)) {
      const powerSensor = powerGroup.Children.find(s => getNodeText(s).toLowerCase().includes('power') || getNodeText(s).toLowerCase().includes('gpu'));
      if (powerSensor) {
        result.gpu.power = parseNumber(powerSensor.Value);
      }
    }
  }

  // --- MOTHERBOARD & CASE FANS EXTRACTION ---
  if (moboSensorNode) {
    const fanGroup = findNode(moboSensorNode, n => getNodeText(n) === 'Fans');
    if (fanGroup && Array.isArray(fanGroup.Children)) {
      for (const sensor of fanGroup.Children) {
        const name = getNodeText(sensor).toLowerCase();
        const val = parseNumber(sensor.Value);
        if (val !== null) {
          const rpm = Math.round(val);
          result.fans.allFans.push({ name: getNodeText(sensor), rpm });

          if (name.includes('cpu fan')) {
            result.fans.cpuFanRpm = rpm;
          } else if (name.includes('fan #1') || name.includes('system #1') || name.includes('system fan #1') || name.includes('sys fan 1') || name.includes('chassis 1')) {
            result.fans.caseIntakeRpm = rpm;
          } else if (name.includes('fan #2') || name.includes('system #2') || name.includes('system fan #2') || name.includes('sys fan 2') || name.includes('chassis 2')) {
            result.fans.caseExhaustRpm = rpm;
          } else if (result.fans.caseIntakeRpm === null && rpm > 0) {
            result.fans.caseIntakeRpm = rpm;
          } else if (result.fans.caseExhaustRpm === null && rpm > 0) {
            result.fans.caseExhaustRpm = rpm;
          }
        }
      }
    }

    const tempGroup = findNode(moboSensorNode, n => getNodeText(n) === 'Temperatures');
    if (tempGroup && Array.isArray(tempGroup.Children)) {
      const sysTemp = tempGroup.Children.find(s => {
        const t = getNodeText(s).toLowerCase();
        return t === 'system' || t.includes('system') || t.includes('motherboard');
      });
      if (sysTemp) {
        result.fans.motherboardTemp = parseNumber(sysTemp.Value);
      }
    }
  }

  return result;
}

module.exports = {
  parseNumber,
  getNodeText,
  findNode,
  findAllNodes,
  parseLhmTree
};
