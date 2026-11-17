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
          throw path.buildCodeFrameError(`[${axe} Axye Compiler] Assignment is not supported - use const/let/var in declaration.`);
        }
      },

      VariableDeclaration(path) {
        const declarations = path.node.declarations;
        if (declarations.length !== 1) return;

        const decl = declarations[0];
        const { id, init } = decl;

        if (t.isCallExpression(init) && t.isIdentifier(init.callee, { name: 'useAxye' }) && t.isObjectPattern(id)) {
          if (!init.arguments || init.arguments.length === 0) return;

          const declKind = path.node.kind;
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

          function extractArrayPaths(elements, currentPath, currentDynamicSelectorId) {
            elements.forEach((elem, index) => {
              if (elem === null) return;

              if (t.isRestElement(elem)) {
                throw path.buildCodeFrameError(`[${axe} Axye Compiler] Rest element is not supported - destructure array separately.`);
              }

              const keyNode = t.numericLiteral(index);
              const mockProp = t.objectProperty(keyNode, elem, true);

              extractStatePaths([mockProp], currentPath, currentDynamicSelectorId);
            });
          }

          function extractStatePaths(properties, currentPath = ['state'], currentDynamicSelectorId = null) {
            properties.forEach((prop) => {
              if (t.isRestElement(prop)) {
                throw path.buildCodeFrameError(`[${axe} Axye Compiler] Rest element is not supported - destructure object separately.`);
              }
              if (!t.isObjectProperty(prop)) return;

              function buildMemberExpression(baseIdentifier, pathArray) {
                const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

                return pathArray.reduce((acc, pathPart) => {
                  const isComputed = typeof pathPart === 'number' || !validIdentifierRegex.test(pathPart);
                  const keyNode = typeof pathPart === 'number' ? t.numericLiteral(pathPart) : t.stringLiteral(pathPart);
                  return t.memberExpression(acc, isComputed ? keyNode : t.identifier(pathPart), isComputed);
                }, baseIdentifier);
              }

              const isLiteralKey = t.isStringLiteral(prop.key) || t.isNumericLiteral(prop.key);

              if (prop.computed && !isLiteralKey) {
                const inlineSelectorId = path.scope.generateUidIdentifier('dynamicSel');
                const selectorParam = path.scope.generateUidIdentifier('s');

                const rootExpr = currentDynamicSelectorId
                  ? t.callExpression(t.cloneNode(currentDynamicSelectorId), [selectorParam])
                  : selectorParam;

                const baseExpr = buildMemberExpression(rootExpr, currentPath);

                const computedMember = t.memberExpression(baseExpr, prop.key, true);
                const innerArrow = t.arrowFunctionExpression([selectorParam], computedMember);

                const deps = currentDynamicSelectorId
                  ? [t.cloneNode(currentDynamicSelectorId), t.cloneNode(prop.key)]
                  : [t.cloneNode(prop.key)];

                const useCallbackCall = t.callExpression(t.memberExpression(t.identifier('React'), t.identifier('useCallback')), [
                  innerArrow,
                  t.arrayExpression(deps),
                ]);

                newNodes.push(t.variableDeclaration('const', [t.variableDeclarator(inlineSelectorId, useCallbackCall)]));

                let targetValue = prop.value;
                let topLevelDefaultValue = null;

                if (t.isAssignmentPattern(targetValue)) {
                  topLevelDefaultValue = targetValue.right;
                  targetValue = targetValue.left;
                }

                if (t.isObjectPattern(targetValue)) {
                  if (topLevelDefaultValue) {
                    throw path.buildCodeFrameError(`[${axe} Axye Compiler] Default values on nested objects are not supported - set defaults only on final properties.`);
                  }
                  extractStatePaths(targetValue.properties, [], inlineSelectorId);
                } else if (t.isArrayPattern(targetValue)) {
                  if (topLevelDefaultValue) {
                    throw path.buildCodeFrameError(`[${axe} Axye Compiler] Default values on nested arrays are not supported - set defaults only on final properties.`);
                  }
                  extractArrayPaths(targetValue.elements, [], inlineSelectorId);
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
                  newNodes.push(t.variableDeclaration(declKind, [t.variableDeclarator(targetValue, finalValue)]));
                }

                return;
              }

              const keyName = t.isNumericLiteral(prop.key) ? prop.key.value : getKeyName(prop.key);
              if (keyName === null || keyName === undefined) {
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
                if (defaultValue) {
                  throw path.buildCodeFrameError(`[${axe} Axye Compiler] Default values on nested objects are not supported - set defaults only on final properties.`);
                }
                extractStatePaths(targetValue.properties, nextPath, currentDynamicSelectorId);
              } else if (t.isArrayPattern(targetValue)) {
                if (defaultValue) {
                  throw path.buildCodeFrameError(`[${axe} Axye Compiler] Default values on nested arrays are not supported - set defaults only on final properties.`);
                }
                extractArrayPaths(targetValue.elements, nextPath, currentDynamicSelectorId);
              } else {
                const localIdentifier = targetValue;
                const selectorParam = path.scope.generateUidIdentifier('s');

                const rootExpr = currentDynamicSelectorId
                  ? t.callExpression(t.cloneNode(currentDynamicSelectorId), [selectorParam])
                  : selectorParam;

                const finalMemberExpression = buildMemberExpression(rootExpr, nextPath);

                let targetSelectorId;

                if (currentDynamicSelectorId) {
                  targetSelectorId = path.scope.generateUidIdentifier('axyeDynamicSel');
                  const innerArrow = t.arrowFunctionExpression([selectorParam], finalMemberExpression);

                  const useCallbackCall = t.callExpression(t.memberExpression(t.identifier('React'), t.identifier('useCallback')), [
                    innerArrow,
                    t.arrayExpression([t.cloneNode(currentDynamicSelectorId)]),
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

                newNodes.push(t.variableDeclaration(declKind, [t.variableDeclarator(localIdentifier, useAxyeCall)]));
              }
            });
          }

          id.properties.forEach((prop) => {
            if (t.isRestElement(prop)) {
              const methodsId = getOrCreateStoreInstance();
              newNodes.push(t.variableDeclaration(declKind, [t.variableDeclarator(prop.argument, t.cloneNode(methodsId))]));
              return;
            }

            if (!t.isObjectProperty(prop)) return;

            const rootKeyName = getKeyName(prop.key);

            if (rootKeyName === 'state') {
              let stateTarget = prop.value;
              let stateDefault = null;

              if (t.isAssignmentPattern(stateTarget)) {
                stateDefault = stateTarget.right;
                stateTarget = stateTarget.left;
              }

              if (t.isObjectPattern(stateTarget)) {
                if (stateDefault) {
                  throw path.buildCodeFrameError(`[${axe} Axye Compiler] Default values on nested objects are not supported - set defaults only on final properties.`);
                }
                extractStatePaths(stateTarget.properties);
              } else if (t.isArrayPattern(stateTarget)) {
                if (stateDefault) {
                  throw path.buildCodeFrameError(`[${axe} Axye Compiler] Default values on nested arrays are not supported - set defaults only on final properties.`);
                }
                extractArrayPaths(stateTarget.elements, ['state'], null);
              } else if (t.isIdentifier(stateTarget)) {
                const selectorParam = path.scope.generateUidIdentifier('s');
                const targetSelectorId = programPath.scope.generateUidIdentifier('axyeSel');
                const staticSelector = t.variableDeclaration('const', [
                  t.variableDeclarator(
                    targetSelectorId,
                    t.arrowFunctionExpression([selectorParam], t.memberExpression(selectorParam, t.identifier('state')))
                  )
                ]);
                programPath.scope.data.axyeSelectors.push(staticSelector);
                let useAxyeCall = t.callExpression(t.identifier('useAxye'), [StoreClassArg, targetSelectorId]);
                if (stateDefault) {
                  useAxyeCall = t.logicalExpression('??', useAxyeCall, stateDefault);
                }
                newNodes.push(t.variableDeclaration(declKind, [t.variableDeclarator(stateTarget, useAxyeCall)]));
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
              newNodes.push(t.variableDeclaration(declKind, [t.variableDeclarator(localIdentifier, methodAccess)]));
            }
          });
          path.replaceWithMultiple(newNodes);
        }
      },
    },
  };
}
