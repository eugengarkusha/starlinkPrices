const { mergeHistory, getDiff, getPastNResults } = require("../history");
const utils = require("../utils");


const available = (country, price, isRefurbed, currency) => ({[country]: utils.available(currency ?? "€", price ?? 1, isRefurbed ?? false)})
const failedToFetch = (country) => ({[country]: utils.failedToFetch})
const jan2_2023 = new Date(2023,0,2, 11,11,11)

test('mergeHistory: recovers to first fetched object', () => {
    const germany = "Germany"
    const result = mergeHistory([
        failedToFetch(germany),
        failedToFetch(germany),
        available(germany),
        available(germany, 42, true),
    ]);

    expect(result).toEqual(available(germany));
});

test('mergeHistory: does not restore deleted countries', () => {
    const germany = "Germany"
    const deletedCountry = "Krokozia"
    const result = mergeHistory([
        {...failedToFetch(germany)},
        {...failedToFetch(germany), ...available(deletedCountry)},
        {...available(germany), ...available(deletedCountry)},
    ]);

    expect(result).toEqual(available(germany));
});

test('mergeHistory: does not overwrite newest available countries', () => {
    const germany = "Germany"
    const ukraine = "Ukraine"
    const result = mergeHistory([
        {...failedToFetch(germany), ...available(ukraine)},
        {...failedToFetch(germany),...available(ukraine, 42, true)},
        {...available(germany, 42, true), ...available(ukraine, 42, true)},
    ]);

    expect(result).toEqual({...available(germany, 42, true), ...available(ukraine)});
});

test('mergeHistory: does not delete newest available countries', () => {
    const germany = "Germany"
    const ukraine = "Ukraine"
    const result = mergeHistory([
        {...failedToFetch(germany), ...available(ukraine)},
        {...failedToFetch(germany)},
        {...available(germany)},
    ]);

    expect(result).toEqual({...available(germany), ...available(ukraine)});
});


test('getDiff: finds non-equal objects by structural equality', () => {
    const germany = "Germany"
    const ukraine = "Ukraine"
    const usa = "USA"
    const poland = "Poland"
    const lithuania = "Lithuania"
    const latvia = "Latvia"

    const prev = {
        ...available(germany),
        ...failedToFetch(ukraine),
        ...failedToFetch(usa),
        ...failedToFetch(lithuania),
        ...available(latvia)
    }
    const next = {
        ...available(germany, undefined, undefined, "USD"),
        ...available(ukraine),
        ...available(poland),
        ...failedToFetch(lithuania),
        ...available(latvia)
    }

    expect(getDiff(prev, next)).toEqual([
        {country: germany, next: next[germany], prev: prev[germany]},
        {country: ukraine, next: next[ukraine], prev: prev[ukraine]},
        {country: usa, next: next[usa], prev: prev[usa]},
        {country: poland, next: next[poland], prev: prev[poland]},
    ]);
});

test('getPastNResults: handle year and month change, empty dates are ignored', () => {
    const jan1_2024 = new Date(2024,0,1, 11,11,11)
    const fetched = getPastNResults(__dirname, 99, jan2_2023)
    expect(fetched).toEqual([{"2023": "Jan2"}, {"2023": "Jan1"}, {"2022": "Dec31"}])
});
test('getPastNResults: fromDate is included', () => {
    const jan2_2023 = new Date(2023,0,2, 11,11,11)
    const fetched = getPastNResults(__dirname, 99, jan2_2023)
    expect(fetched).toEqual([{"2023": "Jan2"}, {"2023": "Jan1"}, {"2022": "Dec31"}])
});

