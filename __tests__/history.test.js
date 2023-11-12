const { mergeHistory, getDiff } = require("../history");
const utils = require("../utils");


const available = (country, price, isRefurbed, currency) => ({[country]: utils.available(currency ?? "€", price ?? 1, isRefurbed ?? false)})
const failedToFetch = (country) => ({[country]: utils.failedToFetch})

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

