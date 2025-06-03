Please see the README.md in bc-tools-extension: [README.md](./bc-tools-extension/README.md)

# Compilation Notes

## Superseded by Later Events

The problem indicated in the `overview.md` has been superseded by events that came later.  Specifically, the `vss-extension.json` issue can be resolved by:

1. do not refer to the file in `contents`
1. do not add the file in `files`
1. do not add a JSON property `overview`
1. put the screen contents in `contents`.`details`.`path` to the appropriate .md, such as:

```
"content": {
    "details": {
        "path": "README.md"
    },
```
