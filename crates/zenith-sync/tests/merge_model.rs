mod support;
use proptest::prelude::*;
use serde_json::{json, Value};
use support::{small, visible, Am, Y};

fn edits(ops: &[u8], actor: usize) -> Value {
    Value::Array(ops.iter().enumerate().map(|(n, op)| match op % 8 {
        0 => json!({"id":"task:t", "field":"name", "value":format!("actor {actor} edit {n}")}),
        1 => json!({"id":"deck:d", "field":"name", "value":format!("deck {actor}-{n}")}),
        2 => json!({"id":"journal:j", "text":format!(" [{actor}-{n}]🧭")}),
        3 => json!({"id":"task:t", "field":"deleted", "value":true}),
        4 => json!({"id":"checklist:c", "field":"done", "value":n%2==0}),
        5 => json!({"id":"reminder:r", "field":"label", "value":format!("reminder {actor}-{n}")}),
        6 => json!({"id":"preferences:shared", "field":"zenInterval", "value":60+n}),
        _ => json!({"id":format!("log:{actor}-{n}"), "create":{
            "id":format!("{actor}-{n}"), "kind":"log", "taskId":"t", "duration":n+1, "deleted":false}}),
    }).collect())
}
macro_rules! converge {
    ($model:ty, $ops:expr, $order:expr) => {{
        let mut base = <$model>::create(&small());
        let mut replicas = [base.fork(), base.fork(), base.fork()];
        for (actor, ops) in $ops.iter().enumerate() {
            for edit in edits(ops, actor).as_array().unwrap() { replicas[actor].edit(&json!([edit])); }
        }
        let snapshots: Vec<_> = replicas.iter_mut().map(|r| r.save()).collect();
        let mut merged = Vec::new();
        for rotate in 0..3 {
            let mut r = <$model>::load(&base.save());
            for i in 0..3 {
                let n = $order[(i + rotate) % 3];
                let mut incoming = <$model>::load(&snapshots[n]);
                r.merge(&mut incoming); r.merge(&mut incoming);
            }
            let mut restarted = <$model>::load(&r.save());
            restarted.edit(&json!([{"id":"task:t", "field":"name", "value":"later"}]));
            merged.push(restarted.json());
        }
        assert_eq!(merged[0], merged[1]); assert_eq!(merged[1], merged[2]);
        let deleted = $ops.iter().any(|ops| ops.iter().any(|op| op % 8 == 3));
        assert_eq!(visible(&merged[0], "task:t"), !deleted);
        assert_eq!(visible(&merged[0], "journal:j"), !deleted);
        for (actor, ops) in $ops.iter().enumerate() {
            for (n, _) in ops.iter().enumerate().filter(|(_, op)| *op % 8 == 2) {
                assert!(merged[0]["journal:j"]["content"].as_str().unwrap().contains(&format!("[{actor}-{n}]🧭")));
            }
            for (n, _) in ops.iter().enumerate().filter(|(_, op)| *op % 8 == 7) {
                assert_eq!(merged[0][format!("log:{actor}-{n}")]["duration"], n+1);
                assert!(visible(&merged[0], &format!("log:{actor}-{n}")));
            }
        }
    }};
}
proptest! {
    #![proptest_config(ProptestConfig::with_cases(96))]
    #[test]
    fn random_partitions_duplicate_delivery_restart_and_order(
        a in prop::collection::vec(any::<u8>(), 0..35),
        b in prop::collection::vec(any::<u8>(), 0..35),
        c in prop::collection::vec(any::<u8>(), 0..35),
        permutation in 0usize..6,
    ) {
        let orders = [[0,1,2], [0,2,1], [1,0,2], [1,2,0], [2,0,1], [2,1,0]];
        let ops = [a,b,c]; let order = orders[permutation];
        converge!(Am, ops, order); converge!(Y, ops, order);
    }
}

macro_rules! text_case {
    ($model:ty) => {{
        let mut base = <$model>::create(&small()); let mut a = base.fork(); let mut b = base.fork();
        a.edit(&json!([{"id":"journal:j", "at":0, "delete":4, "text":"ALPHA"}]));
        b.edit(&json!([{"id":"journal:j", "at":0, "delete":4, "text":"BETA"}]));
        a.merge(&mut b); b.merge(&mut a); assert_eq!(a.json(), b.json());
        let result = a.json(); let text = result["journal:j"]["content"].as_str().unwrap();
        assert!(text.contains("ALPHA") && text.contains("BETA") && text.contains("🧭 café"));
    }};
}
#[test]
fn overlapping_journal_replacements_preserve_both_insertions() {
    text_case!(Am);
    text_case!(Y);
}

#[test]
fn automerge_exposes_concurrent_field_values_for_recovery() {
    use automerge::{ReadDoc, ROOT};
    let mut base = Am::create(&small());
    let mut a = base.fork();
    let mut b = base.fork();
    a.edit(&json!([{"id":"task:t", "field":"name", "value":"A"}]));
    b.edit(&json!([{"id":"task:t", "field":"name", "value":"B"}]));
    a.merge(&mut b);
    let records = a.0.get(ROOT, "records").unwrap().unwrap().1;
    let task = a.0.get(records, "task:t").unwrap().unwrap().1;
    assert_eq!(a.0.get_all(task, "name").unwrap().len(), 2);
}
