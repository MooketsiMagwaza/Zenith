//! S03 spike adapters, shared by the benchmark, convergence and interoperability tests.
//! These are not the network validation API. Input here is trusted synthetic JSON.
use automerge::{transaction::Transactable, AutoCommit, ObjId, ObjType, ReadDoc, ROOT};
use serde_json::{json, Map as JsonMap, Value};
use yrs::{
    types::ToJson, updates::decoder::Decode, Any, Doc, GetString, Map, MapPrelim, MapRef, Out,
    ReadTxn, StateVector, Text, TextPrelim, Transact, Update,
};

pub struct Am(pub AutoCommit);
impl Am {
    pub fn create(records: &Value) -> Self {
        let mut d = AutoCommit::new();
        d.put(ROOT, "schema", 1_i64).unwrap();
        let rs = d.put_object(ROOT, "records", ObjType::Map).unwrap();
        for (id, r) in records.as_object().unwrap() {
            let obj = d.put_object(&rs, id, ObjType::Map).unwrap();
            for (k, v) in r.as_object().unwrap() {
                if k == "content" {
                    let t = d.put_object(&obj, k, ObjType::Text).unwrap();
                    d.splice_text(&t, 0, 0, v.as_str().unwrap()).unwrap();
                } else {
                    am_put(&mut d, &obj, k, v);
                }
            }
        }
        d.commit();
        Self(d)
    }
    pub fn load(bytes: &[u8]) -> Self {
        Self(AutoCommit::load(bytes).unwrap())
    }
    pub fn save(&mut self) -> Vec<u8> {
        self.0.save()
    }
    pub fn fork(&mut self) -> Self {
        Self(self.0.fork())
    }
    pub fn merge(&mut self, other: &mut Self) {
        self.0.merge(&mut other.0).unwrap();
    }
    pub fn edit(&mut self, edits: &Value) {
        let rs = self.0.get(ROOT, "records").unwrap().unwrap().1;
        for e in edits.as_array().unwrap() {
            let r = self
                .0
                .get(&rs, e["id"].as_str().unwrap())
                .unwrap()
                .unwrap()
                .1;
            if let Some(text) = e.get("text") {
                let t = self.0.get(&r, "content").unwrap().unwrap().1;
                let at = e
                    .get("at")
                    .map(|v| v.as_u64().unwrap() as usize)
                    .unwrap_or_else(|| self.0.length(&t));
                let delete = e
                    .get("delete")
                    .map(|v| v.as_i64().unwrap() as isize)
                    .unwrap_or(0);
                self.0
                    .splice_text(&t, at, delete, text.as_str().unwrap())
                    .unwrap();
            } else {
                am_put(&mut self.0, &r, e["field"].as_str().unwrap(), &e["value"]);
            }
        }
        self.0.commit();
    }
    pub fn json(&self) -> Value {
        let rs = self.0.get(ROOT, "records").unwrap().unwrap().1;
        am_json(&self.0, &rs)
    }
}
fn am_put(d: &mut AutoCommit, obj: &ObjId, k: &str, v: &Value) {
    match v {
        Value::String(s) => d.put(obj, k, s.as_str()).unwrap(),
        Value::Bool(b) => d.put(obj, k, *b).unwrap(),
        Value::Number(n) => d.put(obj, k, n.as_i64().unwrap()).unwrap(),
        Value::Null => d.put(obj, k, automerge::ScalarValue::Null).unwrap(),
        _ => panic!("normalized records must have scalar fields"),
    }
}
fn am_json(d: &AutoCommit, obj: &ObjId) -> Value {
    let mut map = JsonMap::new();
    for item in d.map_range(obj, ..) {
        let v = match item.value {
            automerge::Value::Object(ObjType::Text) => json!(d.text(&item.id).unwrap()),
            automerge::Value::Object(ObjType::Map) => am_json(d, &item.id),
            automerge::Value::Scalar(s) => match s.as_ref() {
                automerge::ScalarValue::Str(s) => json!(s.as_str()),
                automerge::ScalarValue::Boolean(b) => json!(b),
                automerge::ScalarValue::Int(n) => json!(n),
                automerge::ScalarValue::Uint(n) => json!(n),
                automerge::ScalarValue::F64(n) => json!(n),
                automerge::ScalarValue::Null => Value::Null,
                _ => panic!("unexpected scalar"),
            },
            _ => panic!("unexpected object"),
        };
        map.insert(item.key.to_string(), v);
    }
    Value::Object(map)
}

pub struct Y(pub Doc);
impl Y {
    pub fn create(records: &Value) -> Self {
        let d = Doc::new();
        {
            let root = d.get_or_insert_map("root");
            let mut tx = d.transact_mut();
            root.insert(&mut tx, "schema", 1_i64);
            let rs = root.insert(&mut tx, "records", MapPrelim::default());
            for (id, r) in records.as_object().unwrap() {
                let m = rs.insert(&mut tx, id.as_str(), MapPrelim::default());
                for (k, v) in r.as_object().unwrap() {
                    if k == "content" {
                        m.insert(&mut tx, k.as_str(), TextPrelim::new(v.as_str().unwrap()));
                    } else {
                        m.insert(&mut tx, k.as_str(), Any::from_json(&v.to_string()).unwrap());
                    }
                }
            }
        }
        Self(d)
    }
    pub fn load(bytes: &[u8]) -> Self {
        let d = Doc::new();
        d.transact_mut()
            .apply_update(Update::decode_v1(bytes).unwrap())
            .unwrap();
        Self(d)
    }
    pub fn save(&self) -> Vec<u8> {
        self.0
            .transact()
            .encode_state_as_update_v1(&StateVector::default())
    }
    pub fn fork(&self) -> Self {
        Self::load(&self.save())
    }
    pub fn merge(&mut self, other: &mut Self) {
        let bytes = other
            .0
            .transact()
            .encode_state_as_update_v1(&self.0.transact().state_vector());
        self.0
            .transact_mut()
            .apply_update(Update::decode_v1(&bytes).unwrap())
            .unwrap();
    }
    pub fn edit(&mut self, edits: &Value) {
        let root = self.0.get_or_insert_map("root");
        let mut tx = self.0.transact_mut();
        let rs: MapRef = root.get(&tx, "records").unwrap().cast().unwrap();
        for e in edits.as_array().unwrap() {
            let r: MapRef = rs
                .get(&tx, e["id"].as_str().unwrap())
                .unwrap()
                .cast()
                .unwrap();
            if let Some(text) = e.get("text") {
                let t = match r.get(&tx, "content").unwrap() {
                    Out::YText(t) => t,
                    _ => panic!("text"),
                };
                let at = e
                    .get("at")
                    .map(|v| v.as_u64().unwrap() as u32)
                    .unwrap_or_else(|| t.len(&tx));
                let delete = e
                    .get("delete")
                    .map(|v| v.as_u64().unwrap() as u32)
                    .unwrap_or(0);
                if delete > 0 {
                    t.remove_range(&mut tx, at, delete);
                }
                t.insert(&mut tx, at, text.as_str().unwrap());
            } else {
                r.insert(
                    &mut tx,
                    e["field"].as_str().unwrap(),
                    Any::from_json(&e["value"].to_string()).unwrap(),
                );
            }
        }
    }
    pub fn json(&self) -> Value {
        let tx = self.0.transact();
        let root = tx.get_map("root").unwrap();
        let rs: MapRef = root.get(&tx, "records").unwrap().cast().unwrap();
        let mut map = JsonMap::new();
        for (id, out) in rs.iter(&tx) {
            let r: MapRef = out.cast().unwrap();
            let mut fields = JsonMap::new();
            for (k, out) in r.iter(&tx) {
                let v = if let Out::YText(t) = out {
                    json!(t.get_string(&tx))
                } else {
                    let mut s = String::new();
                    out.to_json(&tx).to_json(&mut s);
                    serde_json::from_str(&s).unwrap()
                };
                fields.insert(k.into(), v);
            }
            map.insert(id.into(), Value::Object(fields));
        }
        Value::Object(map)
    }
}

pub fn small() -> Value {
    json!({"deck:d": {"id":"d", "kind":"deck", "name":"Deck", "deleted":false},
        "task:t": {"id":"t", "kind":"task", "deckId":"d", "name":"Task", "deleted":false},
        "journal:j": {"id":"j", "kind":"journal", "taskId":"t", "content":"Base 🧭 café\n", "deleted":false}})
}
pub fn visible(records: &Value, id: &str) -> bool {
    let Some(r) = records.get(id) else {
        return false;
    };
    if r["deleted"] == true {
        return false;
    }
    if r["kind"] == "log" {
        return true;
    }
    for (field, kind) in [("taskId", "task"), ("deckId", "deck")] {
        if let Some(parent) = r[field].as_str() {
            if !visible(records, &format!("{kind}:{parent}")) {
                return false;
            }
        }
    }
    if r["kind"] == "reminder" {
        return visible(
            records,
            &format!(
                "{}:{}",
                r["targetType"].as_str().unwrap(),
                r["targetId"].as_str().unwrap()
            ),
        );
    }
    true
}
