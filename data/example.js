// The made-up person. The "Try with a made-up person" button on the Data screen (core/io.js) reads this.
//
// Shape expected (T2.6 fills it in):
//   window.DESK_EXAMPLE = { records: [ { type: 'profile', field: '...' }, { type: 'job', title: '...', stage: 'applied' }, ... ] };
// - `records` is a list of ordinary records. `id` is optional (a profile gets the id "profile"; others get a
//   random id each time they are loaded). Do not set `updated` or `source`: the loader stamps them and marks
//   every record `source: "example"`, so a saved copy never contains them and "Remove the made-up person"
//   deletes them all.
// - It may also be the array itself, or a function returning either one (called when the button is pressed,
//   which is the place to compute dates relative to today).
// - Never put `settings` records here. If the person already has a profile of their own, the example profile
//   is skipped. Keep everything synthetic: no real names, emails or phone numbers.
window.DESK_EXAMPLE = window.DESK_EXAMPLE || {};
