const instructions = require('../instructions');
const parser = require('./parser');
const registerNames = require('../registers');
const { instructionTypes: I } = require('../instructions/meta');

const registerMap = registerNames.reduce((map, r, i) => Object.assign(map, { [r]: i }), {});

const program = `start:
	mov $0a, &0050
loop:
	mov &0050, acc
	dec acc
	mov acc, &0050
	inc r2
	inc r2
	inc r2
	jne $00, &[!loop]
end:
	hlt
`;

const programxx =`mov $42, r1
mov r1, r2
add r1, r1` 

const parsedOutput = parser.run(program);
console.log(parsedOutput)
const machineCode = [];
const labels = {};
let currAddress = 0;

const encodeLitOrMem = lit => {
	let hexVal;
	if (lit.type === 'VARIABLE') {
		if (!(lit.value in labels)) {
			throw new Error(`label ${lit.value} wasn't resolved`);
		}
		hexVal = labels[lit.value];
	} else {
		hexVal = parseInt(lit.value, 16);
	}
	const highByte = (hexVal & 0xff00) >> 8;
	const lowByte = (hexVal & 0x00ff);
	machineCode.push(highByte, lowByte);
}

const encodeLit8 = lit => {
	let hexVal;
	if (lit.type === 'VARIABLE') {
		if (!(lit.value in labels)) {
			throw new Error(`label ${lit.value} wasn't resolved`);
		}
		hexVal = labels[lit.value];
	} else {
		hexVal = parseInt(lit.value, 16);
	}
	const lowByte = (hexVal & 0x00ff);
	machineCode.push(lowByte);
}

const encodeReg = reg => {
	const mappedReg = registerMap[reg.value];
	machineCode.push(mappedReg);
}

parsedOutput.result.forEach(instructionOrLabel => {
	if (instructionOrLabel.type === 'LABEL') {
		labels[instructionOrLabel.value] = currAddress;
	} else {
		const metadata = instructions[instructionOrLabel.value.instruction];
		currAddress += metadata.size;
	}
});

parsedOutput.result.forEach(instruction => {
	if (instruction.type !== 'INSTRUCTION') {
		return;
	}
	const metadata = instructions[instruction.value.instruction];
	machineCode.push(metadata.opcode);

	if ([I.litReg, I.memReg].includes(metadata.type)) {
		encodeLitOrMem(instruction.value.args[0]);
		encodeReg(instruction.value.args[1]);
	}
	if ([I.regLit, I.regMem].includes(metadata.type)) {
		encodeReg(instruction.value.args[0]);	
		encodeLitOrMem(instruction.value.args[1]);
	}
	if (I.regLit8 === metadata.type) {
		encodeReg(instruction.value.args[0]);	
		encodeLit8(instruction.value.args[1]);	
	}
	if ([I.regReg, I.regPtrReg].includes(metadata.type)) {
		encodeReg(instruction.value.args[0]);	
		encodeReg(instruction.value.args[1]);	
	}
	if (I.litMem === metadata.type) {
		encodeLitOrMem(instruction.value.args[0]);
		encodeLitOrMem(instruction.value.args[1]);	
	}
	if (I.litOffReg === metadata.type) {
		encodeLitOrMem(instruction.value.args[0]);
		encodeReg(instruction.value.args[1]);	
		encodeReg(instruction.value.args[2]);	
	}
	if (I.singleReg === metadata.type) {
		encodeReg(instruction.value.args[0]);	
	}
	if (I.singleLit === metadata.type) {
		encodeLitOrMem(instruction.value.args[0]);
	}
})

console.log(machineCode.map(x => '0x' + x.toString(16).padStart('0', 2)).join(','));