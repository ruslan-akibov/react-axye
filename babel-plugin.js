const axe = '\u{1FA93}'; 

export default function babelPluginAxye({ types: t }) {
  function getKeyName(keyNode) {
    if (t.isIdentifier(keyNode)) return keyNode.name;
    if (t.isStringLiteral(keyNode)) return keyNode.value;
    if (t.isNumericLiteral(keyNode)) return String(keyNode.value);
    return null;
  }

  return {
    name: 'babel-plugin-axye',
    visitor: {
      Program: {
        enter(path) {
          path.scope.data.axyeSelectors = [];
        },
        exit(path) {
          const selectors = path.scope.data.axyeSelectors || [];
          if (selectors.length > 0) {
            path.unshiftContainer('body', selectors);
          }
        },
      },

      AssignmentExpression(path) {
        const { right } = path.node;

        if (t.isCallExpression(right) && t.isIdentifier(right.callee, { name: 'useAxye' })) {
          throw path.buildCodeFrameError(`[${axe} Axye Compiler] Assignment is not supported - use const/let in declaration.`);
        }
      },

      VariableDeclaration(path) {
        const declarations = path.node.declarations;
        if (declarations.length !== 1) return;

        const decl = declarations[0];
        const { id, init } = decl;

        if (t.isCallExpression(init) && t.isIdentifier(init.callee, { name: 'useAxye' }) && t.isObjectPattern(id)) {
          if (!init.arguments || init.arguments.length === 0) return;

          const StoreClassArg = t.cloneNode(init.arguments[0]);
          const programPath = path.findParent((p) => p.isProgram());
          const newNodes = [];

          let storeInstanceId = null;
          function getOrCreateStoreInstance() {
            if (!storeInstanceId) {
              storeInstanceId = path.scope.generateUidIdentifier('storeMethods');
              newNodes.push(
                t.variableDeclaration('const', [
                  t.variableDeclarator(
                    storeInstanceId,
                    t.callExpression(t.memberExpression(t.identifier('useAxye'), t.identifier('useMethods')), [StoreClassArg]),
                  ),
                ]),
              );
            }
            return storeInstanceId;
          }

          function extractArrayPaths(elements, currentPath, currentDynamicSelectorId, dynamicKeysAccumulator) {
            elements.forEach((elem, index) => {
              if (elem === null) return;

              if (t.isRestElement(elem)) {
                throw path.buildCodeFrameError(`[${axe} Axye Compiler] Rest element in arrays is not supported - destructure array separately.`);
              }

              const keyNode = t.numericLiteral(index);
              const mockProp = t.objectProperty(keyNode, elem, true);

              extractStatePaths([mockProp], currentPath, currentDynamicSelectorId, dynamicKeysAccumulator);
            });
          }

          function extractStatePaths(properties, currentPath = ['state'], currentDynamicSelectorId = null, dynamicKeysAccumulator = []) {
            properties.forEach((prop) => {
              if (!t.isObjectProperty(prop)) return;

              function buildMemberExpression(baseIdentifier, pathArray) {
                const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

                return pathArray.reduce((acc, pathPart) => {
                  const isComputed = typeof pathPart === 'number' || !validIdentifierRegex.test(pathPart);
                  const keyNode = typeof pathPart === 'number' ? t.numericLiteral(pathPart) : t.stringLiteral(pathPart);
                  return t.memberExpression(acc, isComputed ? keyNode : t.identifier(pathPart), isComputed);
                }, baseIdentifier);
              }

              if (prop.computed) {
                const inlineSelectorId = path.scope.generateUidIdentifier('dynamicSel');
                const selectorParam = t.identifier('_s');

                const baseExpr = currentDynamicSelectorId
                  ? t.callExpression(t.cloneNode(currentDynamicSelectorId), [selectorParam])
                  : buildMemberExpression(selectorParam, currentPath);

                const computedMember = t.memberExpression(baseExpr, prop.key, true);
                const innerArrow = t.arrowFunctionExpression([selectorParam], computedMember);

                const nextDynamicKeys = [...dynamicKeysAccumulator, t.cloneNode(prop.key)];

                const useCallbackCall = t.callExpression(t.memberExpression(t.identifier('React'), t.identifier('useCallback')), [
                  innerArrow,
                  t.arrayExpression(nextDynamicKeys),
                ]);

                newNodes.push(t.variableDeclaration('const', [t.variableDeclarator(inlineSelectorId, useCallbackCall)]));

                let targetValue = prop.value;
                let topLevelDefaultValue = null;

                if (t.isAssignmentPattern(targetValue)) {
                  topLevelDefaultValue = targetValue.right;
                  targetValue = targetValue.left;
                }

                if (t.isObjectPattern(targetValue)) {
                  extractStatePaths(targetValue.properties, [], inlineSelectorId, nextDynamicKeys);
                } else if (t.isArrayPattern(targetValue)) {
                  extractArrayPaths(targetValue.elements, [], inlineSelectorId, nextDynamicKeys);
                } else {
                  const dynamicValueId = path.scope.generateUidIdentifier('dynamicVal');
                  newNodes.push(
                    t.variableDeclaration('const', [
                      t.variableDeclarator(dynamicValueId, t.callExpression(t.identifier('useAxye'), [StoreClassArg, inlineSelectorId])),
                    ]),
                  );

                  let finalValue = dynamicValueId;
                  if (topLevelDefaultValue) {
                    finalValue = t.logicalExpression('??', dynamicValueId, topLevelDefaultValue);
                  }
                  newNodes.push(t.variableDeclaration('const', [t.variableDeclarator(targetValue, finalValue)]));
                }

                return;
              }

              const keyName = getKeyName(prop.key);
              if (!keyName) {
                throw path.buildCodeFrameError(`[${axe} Axye Compiler] Unsupported key type.`);
              }

              const nextPath = [...currentPath, keyName];

              let targetValue = prop.value;
              let defaultValue = null;

              if (t.isAssignmentPattern(targetValue)) {
                defaultValue = targetValue.right;
                targetValue = targetValue.left;
              }

              if (t.isObjectPattern(targetValue)) {
                extractStatePaths(targetValue.properties, nextPath, currentDynamicSelectorId, dynamicKeysAccumulator);
              } else if (t.isArrayPattern(targetValue)) {
                extractArrayPaths(targetValue.elements, nextPath, currentDynamicSelectorId, dynamicKeysAccumulator);
              } else {
                const localIdentifier = targetValue;
                const selectorParam = t.identifier('_s');

                const finalMemberExpression = currentDynamicSelectorId
                  ? buildMemberExpression(t.callExpression(t.cloneNode(currentDynamicSelectorId), [selectorParam]), [keyName])
                  : buildMemberExpression(selectorParam, nextPath);

                let targetSelectorId;

                if (currentDynamicSelectorId) {
                  targetSelectorId = path.scope.generateUidIdentifier('axyeDynamicSel');
                  const innerArrow = t.arrowFunctionExpression([selectorParam], finalMemberExpression);

                  const useCallbackCall = t.callExpression(t.memberExpression(t.identifier('React'), t.identifier('useCallback')), [
                    innerArrow,
                    t.arrayExpression(dynamicKeysAccumulator.map((k) => t.cloneNode(k))),
                  ]);
                  newNodes.push(t.variableDeclaration('const', [t.variableDeclarator(targetSelectorId, useCallbackCall)]));
                } else {
                  targetSelectorId = programPath.scope.generateUidIdentifier('axyeSel');
                  const staticSelector = t.variableDeclaration('const', [
                    t.variableDeclarator(targetSelectorId, t.arrowFunctionExpression([selectorParam], finalMemberExpression)),
                  ]);
                  programPath.scope.data.axyeSelectors.push(staticSelector);
                }

                let useAxyeCall = t.callExpression(t.identifier('useAxye'), [StoreClassArg, targetSelectorId]);

                if (defaultValue) {
                  useAxyeCall = t.logicalExpression('??', useAxyeCall, defaultValue);
                }

                newNodes.push(t.variableDeclaration('const', [t.variableDeclarator(localIdentifier, useAxyeCall)]));
              }
            });
          }

          id.properties.forEach((prop) => {
            if (t.isRestElement(prop)) {
              const methodsId = getOrCreateStoreInstance();
              newNodes.push(t.variableDeclaration('const', [t.variableDeclarator(prop.argument, t.cloneNode(methodsId))]));
              return;
            }

            if (!t.isObjectProperty(prop)) return;

            const rootKeyName = getKeyName(prop.key);

            if (rootKeyName === 'state') {
              if (t.isObjectPattern(prop.value)) {
                extractStatePaths(prop.value.properties);
              } else if (t.isArrayPattern(prop.value)) {
                extractArrayPaths(prop.value.elements, ['state'], null, []);
              } else if (t.isIdentifier(prop.value) || t.isAssignmentPattern(prop.value)) {
                let localIdentifier = prop.value;
                let defaultValue = null;

                if (t.isAssignmentPattern(prop.value)) {
                  localIdentifier = prop.value.left;
                  defaultValue = prop.value.right;
                }

                const targetSelectorId = programPath.scope.generateUidIdentifier('axyeSel');
                const staticSelector = t.variableDeclaration('const', [
                  t.variableDeclarator(
                    targetSelectorId,
                    t.arrowFunctionExpression([t.identifier('_s')], t.memberExpression(t.identifier('_s'), t.identifier('state'))),
                  ),
                ]);
                programPath.scope.data.axyeSelectors.push(staticSelector);
                let useAxyeCall = t.callExpression(t.identifier('useAxye'), [StoreClassArg, targetSelectorId]);
                if (defaultValue) {
                  useAxyeCall = t.logicalExpression('??', useAxyeCall, defaultValue);
                }
                newNodes.push(t.variableDeclaration('const', [t.variableDeclarator(localIdentifier, useAxyeCall)]));
              }
            } else {
              let localIdentifier = prop.value;
              let defaultValue = null;
              if (t.isAssignmentPattern(prop.value)) {
                localIdentifier = prop.value.left;
                defaultValue = prop.value.right;
              }
              const methodsId = getOrCreateStoreInstance();
              let methodAccess = t.memberExpression(methodsId, prop.key, prop.computed);
              if (defaultValue) {
                methodAccess = t.logicalExpression('??', methodAccess, defaultValue);
              }
              newNodes.push(t.variableDeclaration('const', [t.variableDeclarator(localIdentifier, methodAccess)]));
            }
          });
          path.replaceWithMultiple(newNodes);
        }
      },
    },
  };
}
