// Linear Algebra helper functions
function createMatrix(rows, cols, defaultValue = 0) {
    return Array(rows).fill().map(() => Array(cols).fill(defaultValue));
}

function gaussianElimination(A, b) {
    const n = A.length;
    const augmentedMatrix = [];
    
    for (let i = 0; i < n; i++) {
        augmentedMatrix.push([...A[i], b[i]]);
    }
    
    for (let i = 0; i < n; i++) {
        let maxRow = i;
        let maxVal = Math.abs(augmentedMatrix[i][i]);
        
        for (let j = i + 1; j < n; j++) {
            if (Math.abs(augmentedMatrix[j][i]) > maxVal) {
                maxVal = Math.abs(augmentedMatrix[j][i]);
                maxRow = j;
            }
        }
        
        if (maxRow !== i) {
            [augmentedMatrix[i], augmentedMatrix[maxRow]] = [augmentedMatrix[maxRow], augmentedMatrix[i]];
        }
        
        if (Math.abs(augmentedMatrix[i][i]) < FLOAT_TOLERANCE) {
            return { success: false, x: null, message: "Matrix is singular, system may be underdetermined or have no solution." };
        }
        
        for (let j = i + 1; j < n; j++) {
            const factor = augmentedMatrix[j][i] / augmentedMatrix[i][i];
            
            for (let k = i; k <= n; k++) {
                augmentedMatrix[j][k] -= factor * augmentedMatrix[i][k];
            }
        }
    }
    
    const x = new Array(n).fill(0);
    
    for (let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) {
            sum += augmentedMatrix[i][j] * x[j];
        }
        
        x[i] = (augmentedMatrix[i][n] - sum) / augmentedMatrix[i][i];
        
        if (Math.abs(x[i]) < FLOAT_TOLERANCE) {
            x[i] = 0;
        }
    }
    
    return { success: true, x, message: "Solution found." };
}

// Main physics calculation function
function calculateForces(joints, beams) {
    if (!joints.length || !beams.length) {
        return {
            success: false,
            message: "Cannot calculate: Structure is empty.",
            problematicJoints: [],
            results: null,
            reactions: {}
        };
    }
    
    let numAnchors = 0;
    const fixedJoints = [];
    
    for (let i = 0; i < joints.length; i++) {
        if (joints[i].isAnchor) {
            numAnchors++;
            fixedJoints.push(i);
        }
    }
    
    if (numAnchors === 0) {
        return {
            success: false,
            message: "Structure needs at least one anchor.",
            problematicJoints: [],
            results: null,
            reactions: {}
        };
    }
    
    const totalConstraints = numAnchors * 2;
    const totalDOFs = joints.length * 2;
    const numEquations = beams.length + totalConstraints;
    
    if (numEquations < totalDOFs - totalConstraints) {
        return {
            success: false,
            message: "Structure is under-constrained or unstable.",
            problematicJoints: [],
            results: null,
            reactions: {}
        };
    }
    
    const numUnknowns = beams.length + totalConstraints;
    const A = createMatrix(totalDOFs, numUnknowns);
    const b = new Array(totalDOFs).fill(0);
    
    for (let i = 0; i < joints.length; i++) {
        const [fx, fy] = joints[i].load;
        b[i * 2] = -fx;
        b[i * 2 + 1] = -fy;
    }
    
    for (let i = 0; i < beams.length; i++) {
        const beam = beams[i];
        
        if (beam.joint1Idx >= joints.length || beam.joint2Idx >= joints.length) {
            continue;
        }
        
        const joint1 = joints[beam.joint1Idx];
        const joint2 = joints[beam.joint2Idx];
        
        const dx = joint2.x - joint1.x;
        const dy = joint2.y - joint1.y;
        const length = Math.hypot(dx, dy);
        
        if (length < FLOAT_TOLERANCE) {
            return {
                success: false,
                message: "Beam length is too small.",
                problematicJoints: [beam.joint1Idx, beam.joint2Idx],
                results: null,
                reactions: {}
            };
        }
        
        const ux = dx / length;
        const uy = dy / length;
        
        A[beam.joint1Idx * 2][i] = -ux;
        A[beam.joint1Idx * 2 + 1][i] = -uy;
        
        A[beam.joint2Idx * 2][i] = ux;
        A[beam.joint2Idx * 2 + 1][i] = uy;
    }
    
    let reactionColOffset = beams.length;
    for (const jointIdx of fixedJoints) {
        A[jointIdx * 2][reactionColOffset] = 1;
        
        A[jointIdx * 2 + 1][reactionColOffset + 1] = 1;
        
        reactionColOffset += 2;
    }
    
    const solution = gaussianElimination(A, b);
    
    if (!solution.success) {
        return {
            success: false,
            message: "Could not solve the system: " + solution.message,
            problematicJoints: [],
            results: null,
            reactions: {}
        };
    }
    
    const results = solution.x;
    
    for (let i = 0; i < beams.length; i++) {
        beams[i].force = results[i];
        const length = beams[i].getLength(joints);
        if (length > FLOAT_TOLERANCE) {
            beams[i].stress = beams[i].force / beams[i].crossSectionalArea;
        }
    }
    
    const reactions = {};
    let reactionIdx = beams.length;
    
    for (const jointIdx of fixedJoints) {
        reactions[jointIdx] = [results[reactionIdx], results[reactionIdx + 1]];
        reactionIdx += 2;
    }
    
    return {
        success: true,
        message: "Forces calculated successfully.",
        problematicJoints: [],
        results,
        reactions
    };
} 