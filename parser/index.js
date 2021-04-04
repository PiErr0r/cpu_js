const updateParserState = (state, index, result) => ({
	...state,
	index,
	result
});

const updateParserResult = (state, result) => ({
	...state,
	result
});

const updateParserError = (state, errorMsg) => ({
	...state,
	isError: true,
	error: errorMsg
});

class Parser {
	constructor(parserStateTransformerFn) {
		this.parserStateTransformerFn = parserStateTransformerFn;
	}

	run(targetString) {
		const initialState = {
			targetString,
			index: 0,
			result: null,
			isError: false,
			error: null
		}
		console.log(typeof this.parserStateTransformerFn)
		return this.parserStateTransformerFn(initialState);	
	}

	map(fn) {
		return new Parser(parserState => {
			const nextState = this.parserStateTransformerFn(parserState);

			if (nextState.isError) return nextState; 

			return updateParserResult(nextState, fn(nextState.result));
		});
	}

	errorMap(fn) {
		return new Parser(parserState => {
			const nextState = this.parserStateTransformerFn(parserState);
			
			if (!nextState.isError) return nextState; 

			return updateParserError(nextState, fn(nextState.error, nextState.index));
		});
	}

	chain(fn) {
		return new Parser(parserState => {
			const nextState = this.parserStateTransformerFn(parserState);

			if (nextState.isError) return nextState; 

			const nextParser = fn(nextState.result);
			return nextParser.parserStateTransformerFn(nextState);
		});
	}
}

const str = s => new Parser(parserState => {
	const {
		targetString,
		index,
		isError
	} = parserState;

	if (isError) {
		return parserState;
	}

	const slicedTarget = targetString.slice(index);

	if (slicedTarget.length === 0) {
		return updateParserError(
			parserState, 
			`str: Tried to match ${s}, but got Unexpected end of input`
		);
	}

	if (slicedTarget.startsWith(s)) {
		return updateParserState(parserState, index + s.length, s);
	}

	return updateParserError(
		parserState, 
		`str: Tried to match ${s}, but got ${targetString.slice(index, index + 10)}`
	);
});

const lettersRegex = /^[A-Za-z]+/;
const letters = new Parser(parserState => {
	const {
		targetString,
		index,
		isError
	} = parserState;

	if (isError) {
		return parserState;
	}

	const slicedTarget = targetString.slice(index);

	if (slicedTarget.length === 0) {
		return updateParserError(
			parserState, 
			`letters: Got Unexpected end of input`
		);
	}

	const regexMatch = slicedTarget.match(lettersRegex);

	if (regexMatch) {
		return updateParserState(parserState, index + regexMatch[0].length, regexMatch[0]);
	}

	return updateParserError(
		parserState, 
		`letters: Couldn't match any letters at index ${index}`
	);
});

const digitsRegex = /^[0-9]+/;
const digits = new Parser(parserState => {
	const {
		targetString,
		index,
		isError
	} = parserState;

	if (isError) {
		return parserState;
	}

	const slicedTarget = targetString.slice(index);

	if (slicedTarget.length === 0) {
		return updateParserError(
			parserState, 
			`digits: Got Unexpected end of input`
		);
	}

	const regexMatch = slicedTarget.match(digitsRegex);

	if (regexMatch) {
		return updateParserState(parserState, index + regexMatch[0].length, regexMatch[0]);
	}

	return updateParserError(
		parserState, 
		`digits: Couldn't match any digits at index ${index}`
	);
});

const sequenceOf = parsers => new Parser(parserState => {
	if (parserState.isError) {
		return parserState;
	}

	const results = [];
	let nextState = parserState;

	for (let p of parsers) {
		nextState = p.parserStateTransformerFn(nextState);
		results.push(nextState.result);
	}

	return updateParserResult(nextState, results);
});

const choice = parsers => new Parser(parserState => {
	if (parserState.isError) {
		return parserState;
	}

	for (let p of parsers) {
		const nextState = p.parserStateTransformerFn(parserState);
		if (!nextState.isError) {
			return nextState;
		}
	}

	return updateParserError(
		parserState, 
		`choice: Unable to match any parser at index ${parserState.index}`
	);
});

const many = parser => new Parser(parserState => {
	if (parserState.isError) {
		return parserState;
	}

	const results = [];
	let done = false;
	let nextState = parserState;

	while (!done) {
		const tmpState = parser.parserStateTransformerFn(nextState);
		if (!tmpState.isError) {
			results.push(tmpState.result);
			nextState = tmpState;
		} else {
			done = true;
		}
	}

	return updateParserResult(nextState, results);
});

const many1 = parser => new Parser(parserState => {
	if (parserState.isError) {
		return parserState;
	}

	const results = [];
	let done = false;
	let nextState = parserState;

	while (!done) {
		nextState = parser.parserStateTransformerFn(nextState);
		if (!nextState.isError) {
			results.push(nextState.result);
		} else {
			done = true;
		}
	}

	if (results.length === 0) {
		return updateParserError(
			parserState,
			`many1: Unable to match any input using parser at index ${parserState.index}`
		);
	}

	return updateParserResult(nextState, results);
});

const between = (leftParser, rightParser) => contentParser => sequenceOf([
	leftParser,
	contentParser,
	rightParser
]).map(results => results[1]);

//const betweenBrackets = between(str('('), str(')'))
//const parser = betweenBrackets(letters);

const stringResult = { type: "string", value: "hello" };
const numberResult = { type: "number", value: 42 };
const dicerollResult = { type: 'diceroll', value: [2, 8] };

const stringParser = letters.map(result => ({
	type: 'string',
	value: result
}));

const numberParser = digits.map(result => ({
	type: 'number',
	value: Number(result)
}));

const dicerollParser = sequenceOf([
	digits,
	str('d'),
	digits
]).map(([n, _, s]) => ({
	type: 'diceroll',
	value: [Number(n), Number(s)]
}));

const parser = sequenceOf([ letters, str(':') ])
	.map(result => result[0])
	.chain(type => {
		if (type === 'string') 				return stringParser;
		else if (type === 'number') 	return numberParser;
		else if (type === 'diceroll') return dicerollParser;
	})

console.log(
	parser.run('diceroll:12d20')
)